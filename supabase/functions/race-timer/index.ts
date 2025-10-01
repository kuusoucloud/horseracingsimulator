import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Horse race simulation data
interface Horse {
  id: string;
  name: string;
  elo: number;
  position: number;
  finished: boolean;
  finishTime?: number;
}

interface RaceProgress {
  [horseId: string]: {
    position: number;
    speed: number;
    finished: boolean;
    finishTime?: number;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests first
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request')
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    })
  }

  console.log(`📡 Received ${req.method} request to race-timer function`)

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
        console.log('🏁 Pre-race timer finished - starting countdown phase')
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
        // Countdown finished, start race with initial horse positions
        console.log('🏇 Countdown finished - starting race!')
        const initialRaceProgress: RaceProgress = {}
        
        // Initialize all horses at position 0
        const horses = raceState.horses || []
        horses.forEach((horse: any) => {
          initialRaceProgress[horse.id] = {
            position: 0,
            speed: 0,
            finished: false
          }
        })

        updateData = { 
          countdown_timer: 0,
          race_state: 'racing',
          race_start_time: new Date().toISOString(),
          race_timer: 0,
          race_progress: initialRaceProgress,
          timer_owner: 'server'
        }
        message = 'Race started!'
      }
    }
    // Handle RACE SIMULATION (during race)
    else if (raceState.race_state === 'racing') {
      const currentRaceTimer = raceState.race_timer || 0
      const newRaceTimer = currentRaceTimer + 1 // Increment race timer
      console.log(`⏰ Race timer: ${currentRaceTimer} -> ${newRaceTimer}`)

      // Get current race progress or initialize
      let raceProgress: RaceProgress = raceState.race_progress || {}
      const horses = raceState.horses || []
      
      // Initialize race progress if empty
      if (Object.keys(raceProgress).length === 0) {
        horses.forEach((horse: any) => {
          raceProgress[horse.id] = {
            position: 0,
            speed: 0,
            finished: false
          }
        })
      }

      // Simulate race progress for each horse
      let allFinished = true
      const finishedHorses: Array<{id: string, name: string, finishTime: number}> = []

      horses.forEach((horse: any) => {
        const horseProgress = raceProgress[horse.id]
        if (!horseProgress || horseProgress.finished) {
          return // Skip finished horses
        }

        const currentPosition = horseProgress.position || 0
        const horseELO = horse.elo || 1200
        
        // Convert ELO to speed (higher ELO = faster)
        const eloNormalized = Math.max(0, Math.min(1, (horseELO - 400) / 1700))
        const baseSpeed = 0.8 + (eloNormalized * 1.2) // Speed range: 0.8 - 2.0 per second
        
        // Add randomness for exciting races
        const randomFactor = 0.7 + Math.random() * 0.6 // 0.7x to 1.3x
        const currentSpeed = baseSpeed * randomFactor
        
        // Calculate new position
        const newPosition = Math.min(currentPosition + currentSpeed, 1200)
        
        // Check if horse finished
        if (newPosition >= 1200 && !horseProgress.finished) {
          raceProgress[horse.id] = {
            position: 1200,
            speed: currentSpeed,
            finished: true,
            finishTime: newRaceTimer
          }
          finishedHorses.push({
            id: horse.id,
            name: horse.name,
            finishTime: newRaceTimer
          })
          console.log(`🏁 ${horse.name} finished at ${newRaceTimer}s`)
        } else {
          raceProgress[horse.id] = {
            position: newPosition,
            speed: currentSpeed,
            finished: false
          }
          allFinished = false
        }
      })

      updateData = { 
        race_timer: newRaceTimer,
        race_progress: raceProgress,
        timer_owner: 'server'
      }
      message = `Race timer updated to ${newRaceTimer}s`

      // Check if race should finish
      if (allFinished || newRaceTimer >= 80) {
        console.log(`🏁 Race finishing - All finished: ${allFinished}, Timer: ${newRaceTimer}s`)
        updateData.race_state = 'finished'
        message = allFinished ? 'All horses finished!' : 'Race auto-finished after 80 seconds'
        
        // Create final results sorted by finish time and position
        const results = horses.map((horse: any, index: number) => {
          const progress = raceProgress[horse.id]
          return {
            id: horse.id,
            name: horse.name,
            position: progress?.position || 0,
            finishTime: progress?.finishTime || newRaceTimer,
            finished: progress?.finished || false,
            lane: index + 1,
            odds: horse.odds || 2.0,
            horse: horse
          }
        }).sort((a, b) => {
          // Sort by: finished first, then by finish time, then by position
          if (a.finished && !b.finished) return -1
          if (!a.finished && b.finished) return 1
          if (a.finished && b.finished) return a.finishTime - b.finishTime
          return b.position - a.position // Higher position = better placement for unfinished
        }).map((result, index) => ({
          ...result,
          placement: index + 1,
          gap: index === 0 ? "0.00s" : `+${(result.finishTime - results[0].finishTime).toFixed(2)}s`
        }))
        
        updateData.race_results = results
        console.log('🏆 Final results:', results.map(r => `${r.placement}. ${r.name} (${r.finishTime}s)`))
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
        race_timer: raceState.race_timer,
        race_progress: raceState.race_progress
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})