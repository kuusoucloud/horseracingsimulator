import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  console.log(`⏰ Timer function called with ${req.method}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Get current race state
    const { data: raceState, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Error fetching race state:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch race state', details: fetchError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!raceState) {
      return new Response(
        JSON.stringify({ success: true, message: 'No race state found' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let updates: any = {}
    let message = 'Timer tick'

    // Handle different race states
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer > 0) {
      const newTimer = Math.max(0, raceState.pre_race_timer - 1)
      updates.pre_race_timer = newTimer
      
      if (newTimer === 0) {
        updates.race_state = 'countdown'
        updates.countdown_timer = 5
        message = 'Pre-race complete, starting countdown'
        console.log('🏁 Pre-race complete, starting countdown')
      } else {
        message = `Pre-race timer: ${newTimer}s`
      }
    } 
    else if (raceState.race_state === 'countdown' && raceState.countdown_timer > 0) {
      const newCountdown = Math.max(0, raceState.countdown_timer - 1)
      updates.countdown_timer = newCountdown
      
      if (newCountdown === 0) {
        updates.race_state = 'racing'
        updates.race_start_time = new Date().toISOString()
        updates.race_timer = 0
        message = 'Race started!'
        console.log('🏇 Race started!')
      } else {
        message = `Countdown: ${newCountdown}s`
      }
    } 
    else if (raceState.race_state === 'racing') {
      const newRaceTimer = (raceState.race_timer || 0) + 1
      updates.race_timer = newRaceTimer
      
      // Simulate race progress
      const horses = raceState.horses || []
      const updatedHorses = horses.map((horse: any) => {
        if (horse.finishTime) return horse // Already finished
        
        const currentPosition = horse.position || 0
        const baseSpeed = (horse.speed || 0.5) * 15 // Base speed multiplier
        const staminaFactor = Math.max(0.5, horse.stamina || 0.5) // Stamina affects consistency
        const randomVariation = (Math.random() - 0.5) * 8 * staminaFactor // Random variation affected by stamina
        const accelerationBoost = newRaceTimer < 5 ? (horse.acceleration || 0.5) * 5 : 0 // Early race acceleration
        
        const progress = Math.min(1200, currentPosition + baseSpeed + randomVariation + accelerationBoost)
        const finished = progress >= 1200
        
        return {
          ...horse,
          position: progress,
          finishTime: finished ? newRaceTimer : null,
          placement: finished ? null : null // Will be calculated later
        }
      })
      
      // Check if race is complete (all horses finished or 60 second timeout)
      const finishedHorses = updatedHorses.filter((h: any) => h.finishTime)
      const raceTimeout = newRaceTimer >= 60
      
      if (finishedHorses.length >= horses.length || raceTimeout) {
        // Force finish any remaining horses if timeout
        if (raceTimeout) {
          updatedHorses.forEach((horse: any) => {
            if (!horse.finishTime) {
              horse.finishTime = newRaceTimer
              horse.position = Math.min(1200, horse.position || 0)
            }
          })
        }
        
        // Sort by finish time and assign placements
        const sortedHorses = [...updatedHorses].sort((a: any, b: any) => {
          // First by finish time, then by position if same finish time
          if (a.finishTime === b.finishTime) {
            return (b.position || 0) - (a.position || 0)
          }
          return a.finishTime - b.finishTime
        })
        
        sortedHorses.forEach((horse: any, index: number) => {
          horse.placement = index + 1
        })
        
        updates.horses = sortedHorses
        updates.race_state = 'finished'
        updates.race_results = sortedHorses.slice(0, 3) // Top 3
        updates.show_results = true
        updates.show_photo_finish = true
        updates.photo_finish_results = sortedHorses.slice(0, 3)
        message = 'Race finished!'
        console.log('🏁 Race finished!')
      } else {
        updates.horses = updatedHorses
        message = `Race progress: ${newRaceTimer}s, ${finishedHorses.length}/${horses.length} finished`
      }
    }
    else if (raceState.race_state === 'finished') {
      // Race is finished, check if we should start a new one after 30 seconds
      const raceTimer = raceState.race_timer || 0
      if (raceTimer > 30) {
        // Start a new race by calling the race-server function
        try {
          const { error: serverError } = await supabaseClient.functions.invoke('supabase-functions-race-server', {
            body: {},
          })
          
          if (serverError) {
            console.error('❌ Error starting new race:', serverError)
          } else {
            console.log('🔄 Started new race after completion')
            message = 'Started new race'
          }
        } catch (error) {
          console.error('❌ Error calling race server:', error)
        }
      } else {
        message = `Race finished, new race in ${30 - raceTimer}s`
      }
    }

    // Update race state if there are changes
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update(updates)
        .eq('id', raceState.id)

      if (updateError) {
        console.error('❌ Error updating race state:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update race state', details: updateError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message, 
        updates: Object.keys(updates),
        race_state: raceState.race_state 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Timer error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Timer function error', 
        details: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})