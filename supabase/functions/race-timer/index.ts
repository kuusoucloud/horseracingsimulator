import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current race state
    const { data: raceState, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .single()

    if (fetchError) {
      console.error('Error fetching race state:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch race state' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!raceState) {
      return new Response(
        JSON.stringify({ message: 'No race state found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let updateData: any = {}
    let message = 'No update needed'

    // Handle PRE-RACE TIMER (10 seconds countdown)
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer > 0) {
      const newTimer = raceState.pre_race_timer - 1
      console.log(`⏰ Pre-race timer: ${raceState.pre_race_timer} -> ${newTimer}`)

      if (newTimer > 0) {
        updateData = { 
          pre_race_timer: newTimer,
          timer_owner: 'server'
        }
        message = `Pre-race timer updated to ${newTimer}`
      } else {
        // Timer reached 0, start countdown phase
        updateData = { 
          pre_race_timer: 0,
          race_state: 'countdown',
          countdown_timer: 10, // Start 10-second countdown
          timer_owner: 'server'
        }
        message = 'Starting countdown phase'
      }
    }
    // Handle COUNTDOWN TIMER (10 seconds before race starts)
    else if (raceState.race_state === 'countdown') {
      const currentCountdown = raceState.countdown_timer || 10
      const newCountdown = currentCountdown - 1
      console.log(`⏰ Countdown timer: ${currentCountdown} -> ${newCountdown}`)

      if (newCountdown > 0) {
        updateData = { 
          countdown_timer: newCountdown,
          timer_owner: 'server'
        }
        message = `Countdown timer updated to ${newCountdown}`
      } else {
        // Countdown finished, start race
        updateData = { 
          countdown_timer: 0,
          race_state: 'racing',
          race_start_time: new Date().toISOString(),
          race_timer: 0,
          timer_owner: 'server'
        }
        message = 'Race started!'
      }
    }
    // Handle RACE TIMER (during race)
    else if (raceState.race_state === 'racing') {
      const currentRaceTimer = raceState.race_timer || 0
      const newRaceTimer = currentRaceTimer + 1 // Increment race timer
      console.log(`⏰ Race timer: ${currentRaceTimer} -> ${newRaceTimer}`)

      updateData = { 
        race_timer: newRaceTimer,
        timer_owner: 'server'
      }
      message = `Race timer updated to ${newRaceTimer}s`

      // Auto-finish race after 30 seconds if not finished
      if (newRaceTimer >= 30) {
        updateData.race_state = 'finished'
        message = 'Race auto-finished after 30 seconds'
      }
    }

    // Apply updates if any
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update(updateData)
        .eq('id', raceState.id)

      if (updateError) {
        console.error('Error updating race state:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update race state' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('✅ Race state updated:', updateData)
    }

    return new Response(
      JSON.stringify({ 
        message,
        updates: updateData,
        current_state: raceState.race_state,
        current_timer: raceState.pre_race_timer,
        countdown_timer: raceState.countdown_timer,
        race_timer: raceState.race_timer
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})