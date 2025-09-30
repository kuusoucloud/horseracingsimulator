import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateRandomHorses } from './horses.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface Horse {
  id: string;
  name: string;
  elo: number;
  odds: number;
  lane: number;
}

interface RaceProgress {
  [horseId: string]: {
    position: number;
    speed: number;
    finished: boolean;
    finishTime?: number;
  }
}

// Weather conditions interface
interface WeatherConditions {
  timeOfDay: "day" | "night";
  weather: "clear" | "rain";
  skyColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  trackColor: string;
  grassColor: string;
}

// Generate weather conditions for the race
function generateWeatherConditions(): WeatherConditions {
  // Twilight is now 10% chance
  const isTwilight = Math.random() < 0.1;

  // Rain is now 10% chance
  const isRainy = Math.random() < 0.1;

  if (isTwilight) {
    return {
      timeOfDay: "night",
      weather: isRainy ? "rain" : "clear",
      skyColor: isRainy ? "#4a4a6b" : "#6a5acd",
      ambientIntensity: 0.6,
      directionalIntensity: 0.8,
      trackColor: isRainy ? "#5d4e37" : "#8B4513",
      grassColor: isRainy ? "#2d5a2d" : "#228b22",
    };
  } else {
    return {
      timeOfDay: "day",
      weather: isRainy ? "rain" : "clear",
      skyColor: isRainy ? "#6b7280" : "#87ceeb",
      ambientIntensity: 0.4,
      directionalIntensity: isRainy ? 0.7 : 1.0,
      trackColor: isRainy ? "#5d4e37" : "#8B4513",
      grassColor: isRainy ? "#2d5a2d" : "#32cd32",
    };
  }
}

// Global race loop state
let isRaceLoopRunning = false;
let raceLoopInterval: number | null = null;

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function startNewRace() {
  console.log('🏇 Starting new race...')
  
  // Generate new horses
  const horses = generateRandomHorses(8)
  
  // Generate weather for this race (server-side)
  const weather = generateWeatherConditions()
  
  // Delete existing race state
  await supabaseClient.from('race_state').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  // Create new race state
  const newRaceState = {
    race_state: 'pre-race',
    pre_race_timer: 10,
    countdown_timer: 0,
    race_timer: 0,
    race_start_time: null,
    timer_owner: 'server',
    horses: horses,
    race_progress: {},
    race_results: [],
    show_photo_finish: false,
    show_results: false,
    photo_finish_results: [],
    weather_conditions: weather
  }
  
  const { data, error } = await supabaseClient
    .from('race_state')
    .insert(newRaceState)
    .select()
    .single()
    
  if (error) {
    console.error('Error creating race:', error)
    return null
  }
  
  console.log('✅ New race created with weather:', weather.timeOfDay, weather.weather)
  return data
}

async function updateRaceState() {
  try {
    // Get current race state
    const { data: raceState, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .single()

    if (fetchError || !raceState) {
      console.log('No race state found, creating new race...')
      await startNewRace()
      return
    }

    let updateData: any = {}
    let message = 'No update needed'

    // Handle PRE-RACE TIMER (10 seconds countdown)
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer > 0) {
      const newTimer = Math.max(0, raceState.pre_race_timer - 0.1) // Decrease by 0.1 seconds per 100ms update
      console.log(`⏰ Pre-race timer: ${raceState.pre_race_timer.toFixed(1)} -> ${newTimer.toFixed(1)}`)

      if (newTimer > 0) {
        updateData = { 
          pre_race_timer: newTimer,
          timer_owner: 'server'
        }
        message = `Pre-race timer updated to ${newTimer.toFixed(1)}`
      } else {
        // Timer reached 0, start countdown phase
        updateData = { 
          pre_race_timer: 0,
          race_state: 'countdown',
          countdown_timer: 10,
          timer_owner: 'server'
        }
        message = 'Starting countdown phase'
      }
    }
    // Handle COUNTDOWN TIMER (10 seconds before race starts)
    else if (raceState.race_state === 'countdown') {
      const currentCountdown = raceState.countdown_timer || 10
      const newCountdown = Math.max(0, currentCountdown - 0.1) // Decrease by 0.1 seconds per 100ms update
      console.log(`⏰ Countdown timer: ${currentCountdown.toFixed(1)} -> ${newCountdown.toFixed(1)}`)

      if (newCountdown > 0) {
        updateData = { 
          countdown_timer: newCountdown,
          timer_owner: 'server'
        }
        message = `Countdown timer updated to ${newCountdown.toFixed(1)}`
      } else {
        // Countdown finished, start race
        const initialRaceProgress: RaceProgress = {}
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
      const newRaceTimer = currentRaceTimer + 0.1 // Increase by 0.1 seconds per 100ms update
      console.log(`⏰ Race timer: ${currentRaceTimer.toFixed(1)} -> ${newRaceTimer.toFixed(1)}`)

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
          return
        }

        const currentPosition = horseProgress.position || 0
        const horseELO = horse.elo || 1200
        
        // Convert ELO to speed (higher ELO = faster)
        const eloNormalized = Math.max(0, Math.min(1, (horseELO - 400) / 1700))
        const baseSpeed = 15 + (eloNormalized * 25) // 15-40 meters per second
        
        // Add randomness for exciting races
        const randomFactor = 0.7 + Math.random() * 0.6
        const currentSpeed = baseSpeed * randomFactor
        
        // Calculate new position (0.1 second intervals)
        const newPosition = Math.min(currentPosition + (currentSpeed * 0.1), 1200)
        
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
          console.log(`🏁 ${horse.name} finished at ${newRaceTimer.toFixed(1)}s`)
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
      message = `Race timer updated to ${newRaceTimer.toFixed(1)}s`

      // Check if race should finish
      if (allFinished || newRaceTimer >= 80) {
        updateData.race_state = 'finished'
        message = allFinished ? 'All horses finished!' : 'Race auto-finished after 80 seconds'
        
        // Create final results
        const results = horses.map((horse: any, index: number) => {
          const progress = raceProgress[horse.id]
          const placement = progress?.finished ? 
            finishedHorses.findIndex(f => f.id === horse.id) + 1 : 
            horses.length
          
          return {
            id: horse.id,
            name: horse.name,
            position: progress?.position || 0,
            finishTime: progress?.finishTime || newRaceTimer,
            placement: placement,
            lane: index + 1,
            odds: horse.odds || 2.0,
            gap: placement === 1 ? "0.00s" : `+${((progress?.finishTime || newRaceTimer) - (finishedHorses[0]?.finishTime || newRaceTimer)).toFixed(2)}s`,
            horse: horse
          }
        }).sort((a, b) => {
          if (a.placement !== b.placement) return a.placement - b.placement
          return a.finishTime - b.finishTime
        })
        
        updateData.race_results = results
        
        // Determine if we should show photo finish (close race)
        const topThree = results.slice(0, 3)
        const firstFinishTime = topThree[0]?.finishTime || 0
        const thirdFinishTime = topThree[2]?.finishTime || 0
        const timeDifference = thirdFinishTime - firstFinishTime
        
        // Show photo finish if top 3 are within 0.5 seconds of each other
        if (timeDifference <= 0.5 && topThree.length >= 3) {
          updateData.show_photo_finish = true
          updateData.photo_finish_results = topThree
          console.log('📸 Close race detected - showing photo finish')
        } else {
          updateData.show_photo_finish = false
          updateData.show_results = true
          console.log('🏆 Clear winner - showing results directly')
        }
      }
    }
    // Handle FINISHED state with photo finish or results display
    else if (raceState.race_state === 'finished') {
      const finishedTime = raceState.updated_at ? new Date(raceState.updated_at).getTime() : Date.now()
      const currentTime = Date.now()
      const timeSinceFinished = (currentTime - finishedTime) / 1000
      
      // Handle photo finish sequence
      if (raceState.show_photo_finish && timeSinceFinished >= 3) {
        // Show photo finish for 3 seconds, then show results
        updateData = {
          show_photo_finish: false,
          show_results: true
        }
        message = 'Photo finish complete - showing results'
      }
      // Handle results display
      else if (raceState.show_results && timeSinceFinished >= 10) {
        // Show results for 10 seconds, then start new race
        console.log('🔄 Results shown for 10 seconds, starting new race...')
        await startNewRace()
        return
      }
      // Auto-fallback if no display states are set
      else if (!raceState.show_photo_finish && !raceState.show_results && timeSinceFinished >= 2) {
        updateData = {
          show_results: true
        }
        message = 'Auto-showing results'
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
        return
      }

      console.log('✅ Race state updated:', message)
    }

  } catch (error) {
    console.error('Error in race loop:', error)
  }
}

function startRaceLoop() {
  if (isRaceLoopRunning) {
    console.log('Race loop already running')
    return
  }
  
  console.log('🚀 Starting race server loop with proper timing...')
  isRaceLoopRunning = true
  
  // Update race state every 1000ms (1 second) for proper real-time timing
  raceLoopInterval = setInterval(updateRaceState, 1000)
  
  // Also run immediately
  updateRaceState()
}

function stopRaceLoop() {
  if (raceLoopInterval) {
    clearInterval(raceLoopInterval)
    raceLoopInterval = null
  }
  isRaceLoopRunning = false
  console.log('🛑 Race server loop stopped')
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    })
  }

  console.log(`📡 Race server request: ${req.method}`)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'status'

    switch (action) {
      case 'start':
        startRaceLoop()
        return new Response(
          JSON.stringify({ message: 'Race server started', running: isRaceLoopRunning }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
        
      case 'stop':
        stopRaceLoop()
        return new Response(
          JSON.stringify({ message: 'Race server stopped', running: isRaceLoopRunning }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
        
      case 'status':
      default:
        // Get current race state
        const { data: raceState } = await supabaseClient
          .from('race_state')
          .select('*')
          .limit(1)
          .single()
          
        return new Response(
          JSON.stringify({ 
            message: 'Race server status',
            running: isRaceLoopRunning,
            raceState: raceState || null
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

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

// Auto-start the race loop when the function loads
console.log('🏇 Race server function loaded, starting autonomous race loop...')
startRaceLoop()