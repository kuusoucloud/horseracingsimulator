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

    // Only process if race is in pre-race state with timer > 0
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer > 0) {
      const newTimer = raceState.pre_race_timer - 1
      
      console.log(`⏰ Server timer update: ${raceState.pre_race_timer} -> ${newTimer}`)

      // Update the timer
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update({ 
          pre_race_timer: newTimer,
          timer_owner: 'server' // Mark as server-managed
        })
        .eq('id', raceState.id)

      if (updateError) {
        console.error('Error updating timer:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update timer' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          message: 'Timer updated', 
          timer: newTimer,
          race_state: raceState.race_state
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If timer reached 0, start countdown phase
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer === 0) {
      console.log('⏰ Server starting countdown phase')
      
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update({ 
          race_state: 'countdown',
          timer_owner: 'server'
        })
        .eq('id', raceState.id)

      if (updateError) {
        console.error('Error starting countdown:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to start countdown' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({ 
          message: 'Countdown started', 
          race_state: 'countdown'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'No timer update needed',
        current_timer: raceState.pre_race_timer,
        race_state: raceState.race_state
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