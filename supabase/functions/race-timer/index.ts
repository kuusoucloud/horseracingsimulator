import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  console.log(`⏰ Timer function called with ${req.method}`)

  // Handle CORS preflight - MUST be first
  if (req.method === 'OPTIONS') {
    console.log('🔄 Timer CORS preflight')
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      },
    })
  }

  // Standard headers for all responses
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
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
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Error fetching race state:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch race state' }),
        { status: 500, headers: responseHeaders }
      )
    }

    if (!raceState) {
      return new Response(
        JSON.stringify({ message: 'No race state found' }),
        { status: 200, headers: responseHeaders }
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
      } else {
        message = `Pre-race timer: ${newTimer}s`
      }
    } else if (raceState.race_state === 'countdown' && raceState.countdown_timer > 0) {
      const newCountdown = Math.max(0, raceState.countdown_timer - 1)
      updates.countdown_timer = newCountdown
      
      if (newCountdown === 0) {
        updates.race_state = 'racing'
        updates.race_start_time = new Date().toISOString()
        updates.race_timer = 0
        message = 'Race started!'
      } else {
        message = `Countdown: ${newCountdown}s`
      }
    } else if (raceState.race_state === 'racing') {
      const newRaceTimer = (raceState.race_timer || 0) + 1
      updates.race_timer = newRaceTimer
      
      // Simulate race progress
      const horses = raceState.horses || []
      const updatedHorses = horses.map((horse: any) => {
        if (horse.finishTime) return horse // Already finished
        
        // Ensure horse has a starting position
        const currentPosition = horse.position || 0
        const baseSpeed = (horse.speed || 0.5) * 20 // Base speed multiplier
        const randomVariation = Math.random() * 10 + 5 // Random variation 5-15
        const progress = Math.min(1200, currentPosition + baseSpeed + randomVariation)
        const finished = progress >= 1200
        
        return {
          ...horse,
          position: progress,
          finishTime: finished ? newRaceTimer : null,
          placement: finished ? null : null // Will be calculated later
        }
      })
      
      // Check if race is complete
      const finishedHorses = updatedHorses.filter((h: any) => h.finishTime)
      if (finishedHorses.length >= horses.length) {
        // Sort by finish time and assign placements
        const sortedHorses = [...updatedHorses].sort((a: any, b: any) => a.finishTime - b.finishTime)
        sortedHorses.forEach((horse: any, index: number) => {
          horse.placement = index + 1
        })
        
        updates.horses = sortedHorses
        updates.race_state = 'finished'
        updates.race_results = sortedHorses.slice(0, 3) // Top 3
        updates.show_results = true
        message = 'Race finished!'
      } else {
        updates.horses = updatedHorses
        message = `Race progress: ${newRaceTimer}s`
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
          JSON.stringify({ error: 'Failed to update race state' }),
          { status: 500, headers: responseHeaders }
        )
      }
    }

    return new Response(
      JSON.stringify({ message, updates: Object.keys(updates) }),
      { status: 200, headers: responseHeaders }
    )

  } catch (error) {
    console.error('❌ Timer error:', error)
    return new Response(
      JSON.stringify({ error: 'Timer function error', details: error.message }),
      { status: 500, headers: responseHeaders }
    )
  }
})