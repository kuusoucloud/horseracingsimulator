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

// ELO Rating System Constants
const STARTING_ELO = 500; // All horses start at 500 ELO
const K_FACTOR_PODIUM = 192; // Increased K-factor for podium finishers (1st, 2nd, 3rd)
const K_FACTOR_OTHERS = 32; // Standard K-factor for others

// Update ELO ratings after a race
async function updateHorseEloRatings(raceResults: any[]) {
  console.log('🏁 Updating ELO ratings for race results:', raceResults.map(r => ({ name: r.name, placement: r.placement })));
  
  try {
    // Get current ELO ratings for all horses
    const horseNames = raceResults.map(r => r.name);
    const { data: existingHorses } = await supabaseClient
      .from('horses')
      .select('name, elo, total_races, wins, recent_form')
      .in('name', horseNames);
    
    const existingHorsesMap = new Map(existingHorses?.map(h => [h.name, h]) || []);
    
    // Initialize new horses with starting ELO
    const newHorses = [];
    for (const result of raceResults) {
      if (!existingHorsesMap.has(result.name)) {
        newHorses.push({
          name: result.name,
          elo: STARTING_ELO,
          total_races: 0,
          wins: 0,
          recent_form: []
        });
        console.log(`🆕 New horse ${result.name} initialized with ELO: ${STARTING_ELO}`);
      }
    }
    
    // Insert new horses
    if (newHorses.length > 0) {
      await supabaseClient.from('horses').insert(newHorses);
      // Add to existing map
      newHorses.forEach(h => existingHorsesMap.set(h.name, h));
    }
    
    // Calculate ELO changes for each pair of horses
    const updatedRatings = new Map();
    
    // Initialize with current ratings
    raceResults.forEach(result => {
      const horse = existingHorsesMap.get(result.name);
      updatedRatings.set(result.name, horse?.elo || STARTING_ELO);
    });
    
    // Calculate ELO changes for each pair
    for (let i = 0; i < raceResults.length; i++) {
      for (let j = i + 1; j < raceResults.length; j++) {
        const horse1 = raceResults[i];
        const horse2 = raceResults[j];
        
        const rating1 = updatedRatings.get(horse1.name);
        const rating2 = updatedRatings.get(horse2.name);
        
        // Expected scores based on ELO difference
        const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
        const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));
        
        // Actual scores (horse1 finished ahead of horse2)
        const actual1 = 1;
        const actual2 = 0;
        
        // Determine K-factors based on podium placement
        const k1 = horse1.placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
        const k2 = horse2.placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
        
        // Calculate new ratings
        const newRating1 = rating1 + k1 * (actual1 - expected1);
        const newRating2 = rating2 + k2 * (actual2 - expected2);
        
        updatedRatings.set(horse1.name, Math.max(100, newRating1)); // Minimum ELO of 100
        updatedRatings.set(horse2.name, Math.max(100, newRating2));
      }
    }
    
    // Update database with new ratings and stats
    const updates = [];
    for (const result of raceResults) {
      const horse = existingHorsesMap.get(result.name);
      const oldRating = horse?.elo || STARTING_ELO;
      const newRating = updatedRatings.get(result.name);
      const change = Math.round(newRating - oldRating);
      const kFactor = result.placement <= 3 ? K_FACTOR_PODIUM : K_FACTOR_OTHERS;
      
      // Update recent form (keep last 5 races)
      const recentForm = [...(horse?.recent_form || [])];
      recentForm.unshift(result.placement);
      if (recentForm.length > 5) {
        recentForm.length = 5;
      }
      
      updates.push({
        name: result.name,
        elo: Math.round(newRating),
        total_races: (horse?.total_races || 0) + 1,
        wins: (horse?.wins || 0) + (result.placement === 1 ? 1 : 0),
        recent_form: recentForm,
        updated_at: new Date().toISOString()
      });
      
      console.log(`📊 ${result.name} (${result.placement}${getOrdinalSuffix(result.placement)}): ${Math.round(oldRating)} → ${Math.round(newRating)} (${change > 0 ? '+' : ''}${change}) [K=${kFactor}]`);
    }
    
    // Batch update all horses
    for (const update of updates) {
      await supabaseClient
        .from('horses')
        .upsert(update, { onConflict: 'name' });
    }
    
    console.log('💾 ELO ratings updated and saved to database!');
    return updates;
    
  } catch (error) {
    console.error('Error updating ELO ratings:', error);
    return [];
  }
}

// Helper function to get ordinal suffix
function getOrdinalSuffix(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = n % 100;
  if (remainder >= 11 && remainder <= 13) {
    return suffixes[0];
  }
  return suffixes[n % 10] || suffixes[0];
}

async function startNewRace() {
  console.log('🏇 Starting new race...')
  
  // Generate new horses with database ELO ratings
  const horses = await generateRandomHorsesWithELO(8)
  
  // Generate weather for this race (server-side)
  const weather = generateWeatherConditions()
  console.log('🌤️ Generated weather conditions:', weather)
  
  // Delete existing race state to ensure clean start
  await supabaseClient.from('race_state').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  // Create new race state - ALWAYS start at pre-race
  const newRaceState = {
    race_state: 'pre-race',
    pre_race_timer: 10,
    countdown_timer: 0,
    race_timer: 0,
    finish_timer: 0,
    race_start_time: null,
    timer_owner: 'server',
    horses: horses,
    race_progress: {},
    race_results: [],
    show_photo_finish: false,
    show_results: false,
    photo_finish_results: [],
    weather_conditions: weather,
    last_update_time: new Date().toISOString() // Initialize timestamp
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
  console.log('🌤️ Weather conditions stored:', data.weather_conditions)
  console.log('🏇 Horses with ELO ratings:', horses.map(h => ({ name: h.name, elo: h.elo })))
  console.log('⏰ Race initialized at pre-race stage with 10 second timer')
  return data
}

// Generate random horses with database ELO ratings
async function generateRandomHorsesWithELO(count: number = 8): Promise<any[]> {
  try {
    // Get all horses from database
    const { data: dbHorses } = await supabaseClient
      .from('horses')
      .select('name, elo, total_races, wins, recent_form')
      .order('elo', { ascending: false })
    
    let availableHorses = dbHorses || []
    
    // If we don't have enough horses in database, create some from the static list
    if (availableHorses.length < count) {
      console.log(`🆕 Need more horses in database (${availableHorses.length}/${count}), adding from static list...`)
      
      // Import the static horse database
      const { generateRandomHorses } = await import('./horses.ts')
      const staticHorses = generateRandomHorses(count - availableHorses.length)
      
      // Add missing horses to database
      const newHorses = staticHorses.map(horse => ({
        name: horse.name,
        elo: STARTING_ELO,
        total_races: 0,
        wins: 0,
        recent_form: []
      }))
      
      await supabaseClient.from('horses').insert(newHorses)
      
      // Add to available horses
      availableHorses = [...availableHorses, ...newHorses]
    }
    
    // Select horses using weighted selection based on ELO
    const selectedHorses = selectHorsesWeighted(availableHorses, count)
    
    // Calculate odds based on ELO ratings
    const oddsData = calculateOddsFromELO(selectedHorses)
    
    return selectedHorses.map((horse, index) => {
      const odds = oddsData.find(o => o.name === horse.name)?.odds || 5.0
      
      // Generate attributes based on ELO
      const baseSpeed = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 20))
      const baseStamina = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 25))
      const baseAcceleration = Math.max(60, Math.min(95, 60 + (horse.elo - 500) / 22))
      
      // Add some randomness
      const speed = Math.round(baseSpeed + (Math.random() - 0.5) * 10)
      const stamina = Math.round(baseStamina + (Math.random() - 0.5) * 10)
      const acceleration = Math.round(baseAcceleration + (Math.random() - 0.5) * 10)
      
      return {
        id: `horse-${index + 1}`,
        name: horse.name,
        lane: index + 1,
        elo: horse.elo,
        odds: odds,
        speed: Math.max(60, Math.min(95, speed)),
        stamina: Math.max(60, Math.min(95, stamina)),
        acceleration: Math.max(60, Math.min(95, acceleration)),
        color: getHorseColor(horse.name),
        sprintStartPercent: 40 + Math.random() * 35,
        total_races: horse.total_races || 0,
        wins: horse.wins || 0,
        recent_form: horse.recent_form || []
      }
    })
    
  } catch (error) {
    console.error('Error generating horses with ELO:', error)
    // Fallback to static generation
    const { generateRandomHorses } = await import('./horses.ts')
    return generateRandomHorses(count)
  }
}

// Weighted horse selection based on ELO tiers
function selectHorsesWeighted(horses: any[], count: number): any[] {
  const weightedHorses = horses.map(horse => {
    let weight: number
    
    if (horse.elo >= 2200) {
      weight = 1 // Mythical: Extremely rare
    } else if (horse.elo >= 2000) {
      weight = 2 // Legendary: Very rare
    } else if (horse.elo >= 1900) {
      weight = 3 // Legendary: Rare
    } else if (horse.elo >= 1800) {
      weight = 5 // Champion: Uncommon
    } else if (horse.elo >= 1700) {
      weight = 8 // Elite: Less common
    } else if (horse.elo >= 1600) {
      weight = 12 // Expert: Moderate
    } else if (horse.elo >= 1400) {
      weight = 20 // Competitive: Common
    } else if (horse.elo >= 1200) {
      weight = 30 // Underdog: Very common
    } else if (horse.elo >= 1000) {
      weight = 25 // Long shot: Common
    } else {
      weight = 15 // Extreme long shot: Less common
    }
    
    return { horse, weight }
  })
  
  // Create weighted selection pool
  const selectionPool: any[] = []
  weightedHorses.forEach(({ horse, weight }) => {
    for (let i = 0; i < weight; i++) {
      selectionPool.push(horse)
    }
  })
  
  // Randomly select horses from the weighted pool
  const selectedHorses: any[] = []
  const usedHorses = new Set<string>()
  
  while (selectedHorses.length < count && selectedHorses.length < horses.length) {
    const randomIndex = Math.floor(Math.random() * selectionPool.length)
    const selectedHorse = selectionPool[randomIndex]
    
    // Ensure no duplicates
    if (!usedHorses.has(selectedHorse.name)) {
      selectedHorses.push(selectedHorse)
      usedHorses.add(selectedHorse.name)
    }
  }
  
  return selectedHorses
}

// Calculate odds based on ELO ratings
function calculateOddsFromELO(horses: any[]): { name: string; odds: number }[] {
  // Sort horses by ELO descending
  const sortedHorses = [...horses].sort((a, b) => b.elo - a.elo)
  
  // Calculate relative strength based on ELO differences
  const probabilities = sortedHorses.map(horse => {
    let totalStrength = 0
    let thisHorseStrength = 0
    
    sortedHorses.forEach(h => {
      const strength = Math.pow(10, h.elo / 400) // Chess-like ELO scaling
      totalStrength += strength
      if (h.name === horse.name) {
        thisHorseStrength = strength
      }
    })
    
    let probability = thisHorseStrength / totalStrength
    
    // Apply tier-based multipliers
    if (horse.elo >= 2000) {
      probability *= 1.5 // Mythical boost
    } else if (horse.elo >= 1900) {
      probability *= 1.3 // Legendary boost
    } else if (horse.elo >= 1800) {
      probability *= 1.2 // Champion boost
    } else if (horse.elo >= 1600) {
      probability *= 1.1 // Elite boost
    } else if (horse.elo < 1000) {
      probability *= 0.7 // Weak penalty
    } else if (horse.elo < 800) {
      probability *= 0.5 // Very weak penalty
    }
    
    return { name: horse.name, probability: Math.max(0.005, probability) }
  })
  
  // Normalize probabilities
  const totalProb = probabilities.reduce((sum, p) => sum + p.probability, 0)
  const normalizedProbs = probabilities.map(p => ({
    name: p.name,
    probability: p.probability / totalProb
  }))
  
  // Convert to odds
  return normalizedProbs.map(p => {
    const adjustedProb = p.probability * 0.98
    let odds = 1 / adjustedProb
    
    // Round appropriately
    if (odds < 1.5) {
      odds = Math.round(odds * 100) / 100
    } else if (odds < 5) {
      odds = Math.round(odds * 20) / 20
    } else if (odds < 15) {
      odds = Math.round(odds * 10) / 10
    } else if (odds < 50) {
      odds = Math.round(odds * 2) / 2
    } else {
      odds = Math.round(odds)
    }
    
    return {
      name: p.name,
      odds: Math.max(1.01, odds)
    }
  })
}

// Generate a static color for a horse based on its name
function getHorseColor(horseName: string): string {
  const colors = [
    "#8B4513", "#D2B48C", "#654321", "#2F1B14", "#F5F5DC"
  ]
  
  let hash = 0
  for (let i = 0; i < horseName.length; i++) {
    const char = horseName.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  return colors[Math.abs(hash) % colors.length]
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

    // Track real seconds using timestamps instead of simple counters
    const now = Date.now()
    const lastUpdate = raceState.last_update_time ? new Date(raceState.last_update_time).getTime() : (now - 1100) // Default to 1.1 seconds ago if no timestamp
    const timeDelta = (now - lastUpdate) / 1000 // Convert to seconds
    
    // Only update timers if at least 1 full second has passed
    const shouldUpdateTimers = timeDelta >= 1.0
    // But update race progress more frequently for smooth animation
    const shouldUpdateRaceProgress = timeDelta >= 0.25 && raceState.race_state === 'racing'

    let updateData: any = {
      last_update_time: new Date(now).toISOString() // Always update timestamp
    }
    let message = 'Timestamp updated'

    // Handle PRE-RACE TIMER (10 seconds countdown)
    if (raceState.race_state === 'pre-race' && raceState.pre_race_timer > 0) {
      if (shouldUpdateTimers) {
        const newTimer = Math.max(0, raceState.pre_race_timer - 1)
        console.log(`⏰ Pre-race timer: ${raceState.pre_race_timer} -> ${newTimer} (delta: ${timeDelta.toFixed(2)}s)`)

        if (newTimer > 0) {
          updateData = { 
            ...updateData,
            pre_race_timer: newTimer,
            timer_owner: 'server'
          }
          message = `Pre-race timer updated to ${newTimer}`
        } else {
          // Timer reached 0, start countdown phase
          updateData = { 
            ...updateData,
            pre_race_timer: 0,
            race_state: 'countdown',
            countdown_timer: 10,
            timer_owner: 'server'
          }
          message = 'Starting countdown phase'
        }
      }
    }
    // Handle COUNTDOWN TIMER (10 seconds before race starts)
    else if (raceState.race_state === 'countdown') {
      if (shouldUpdateTimers) {
        const currentCountdown = raceState.countdown_timer || 10
        const newCountdown = Math.max(0, currentCountdown - 1)
        console.log(`⏰ Countdown timer: ${currentCountdown} -> ${newCountdown} (delta: ${timeDelta.toFixed(2)}s)`)

        if (newCountdown > 0) {
          updateData = { 
            ...updateData,
            countdown_timer: newCountdown,
            timer_owner: 'server'
          }
          message = `Countdown timer updated to ${newCountdown}`
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
            ...updateData,
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
    }
    // Handle RACE SIMULATION (during race) - Update more frequently for smooth animation
    else if (raceState.race_state === 'racing') {
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

      // Update race timer only every second
      if (shouldUpdateTimers) {
        const currentRaceTimer = raceState.race_timer || 0
        const newRaceTimer = currentRaceTimer + 1
        console.log(`⏰ Race timer: ${currentRaceTimer} -> ${newRaceTimer} (delta: ${timeDelta.toFixed(2)}s)`)
        updateData.race_timer = newRaceTimer
        message = `Race timer updated to ${newRaceTimer}s`
      }

      // Update race progress more frequently (every 250ms) for smooth animation
      if (shouldUpdateRaceProgress || shouldUpdateTimers) {
        const currentRaceTimer = updateData.race_timer || raceState.race_timer || 0
        
        // Simulate race progress for each horse
        let allFinished = true
        const finishedHorses: Array<{id: string, name: string, finishTime: number}> = []

        horses.forEach((horse: any) => {
          const horseProgress = raceProgress[horse.id]
          if (!horseProgress || horseProgress.finished) {
            return
          }

          const currentPosition = horseProgress.position || 0
          const horseELO = horse.elo || 500
          
          // Convert ELO to speed (higher ELO = faster)
          const eloNormalized = Math.max(0, Math.min(1, (horseELO - 200) / 1300))
          const baseSpeed = 15 + (eloNormalized * 25) // 15-40 meters per second
          
          // Add randomness for exciting races
          const randomFactor = 0.7 + Math.random() * 0.6
          const currentSpeed = baseSpeed * randomFactor
          
          // Calculate new position - use actual time delta for smooth movement
          const positionIncrement = currentSpeed * timeDelta
          const newPosition = Math.min(currentPosition + positionIncrement, 1200)
          
          // Check if horse finished
          if (newPosition >= 1200 && !horseProgress.finished) {
            raceProgress[horse.id] = {
              position: 1200,
              speed: currentSpeed,
              finished: true,
              finishTime: currentRaceTimer + (timeDelta * (1200 - currentPosition) / positionIncrement)
            }
            finishedHorses.push({
              id: horse.id,
              name: horse.name,
              finishTime: raceProgress[horse.id].finishTime!
            })
            console.log(`🏁 ${horse.name} finished at ${raceProgress[horse.id].finishTime!.toFixed(2)}s`)
          } else {
            raceProgress[horse.id] = {
              position: newPosition,
              speed: currentSpeed,
              finished: false
            }
            allFinished = false
          }
        })

        updateData.race_progress = raceProgress

        // Check if race should finish (only on timer updates)
        if (shouldUpdateTimers && (allFinished || currentRaceTimer >= 80)) {
          updateData.race_state = 'finished'
          updateData.finish_timer = 0
          message = allFinished ? 'All horses finished!' : 'Race auto-finished after 80 seconds'
          
          // Create final results with correct placement calculation
          const finishedHorsesWithTimes = horses.map((horse: any, index: number) => {
            const progress = raceProgress[horse.id]
            return {
              id: horse.id,
              name: horse.name,
              position: progress?.position || 0,
              finishTime: progress?.finishTime || currentRaceTimer,
              lane: index + 1,
              odds: horse.odds || 2.0,
              horse: horse
            }
          }).sort((a, b) => {
            // Sort by finish time first, then by position if times are equal
            if (Math.abs(a.finishTime - b.finishTime) < 0.01) {
              return b.position - a.position
            }
            return a.finishTime - b.finishTime
          })
          
          const results = finishedHorsesWithTimes.map((horse, index) => ({
            ...horse,
            placement: index + 1,
            gap: index === 0 ? "0.00s" : `+${(horse.finishTime - finishedHorsesWithTimes[0].finishTime).toFixed(2)}s`
          }))
          
          console.log('🏁 Final race results:', results.map(r => `${r.placement}. ${r.name} (${r.finishTime.toFixed(2)}s)`))
          
          updateData.race_results = results
          
          // Update ELO ratings after race completion
          console.log('🏆 Race finished, updating ELO ratings...')
          await updateHorseEloRatings(results)
          
          // Determine if we should show photo finish
          const topThree = results.slice(0, 3)
          const firstFinishTime = topThree[0]?.finishTime || 0
          const thirdFinishTime = topThree[2]?.finishTime || 0
          const timeDifference = thirdFinishTime - firstFinishTime
          
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
    }
    // Handle FINISHED state with proper timing
    else if (raceState.race_state === 'finished') {
      if (shouldUpdateTimers) {
        const currentFinishTimer = raceState.finish_timer || 0
        const newFinishTimer = currentFinishTimer + 1
        
        console.log(`🏁 Finish timer: ${currentFinishTimer} -> ${newFinishTimer} (delta: ${timeDelta.toFixed(2)}s)`)
        
        // Handle photo finish sequence (3 seconds)
        if (raceState.show_photo_finish && newFinishTimer <= 3) {
          updateData = {
            ...updateData,
            finish_timer: newFinishTimer
          }
          message = `Photo finish display: ${newFinishTimer}/3 seconds`
        }
        // Transition from photo finish to results
        else if (raceState.show_photo_finish && newFinishTimer > 3) {
          updateData = {
            ...updateData,
            finish_timer: newFinishTimer,
            show_photo_finish: false,
            show_results: true
          }
          message = 'Photo finish complete - showing results'
        }
        // Handle results display (10 seconds total)
        else if (raceState.show_results && newFinishTimer <= 10) {
          updateData = {
            ...updateData,
            finish_timer: newFinishTimer
          }
          message = `Results display: ${newFinishTimer}/10 seconds`
        }
        // Start new race after 10 seconds
        else if (newFinishTimer > 10) {
          console.log('🔄 Starting new race after 10 seconds...')
          await supabaseClient
            .from('race_state')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000')
          
          await startNewRace()
          return
        }
        // Auto-show results if no display state is set
        else if (!raceState.show_photo_finish && !raceState.show_results) {
          updateData = {
            ...updateData,
            finish_timer: newFinishTimer,
            show_results: true
          }
          message = 'Auto-showing results'
        }
      }
    }

    // Apply updates only if we have meaningful changes
    if (shouldUpdateTimers || shouldUpdateRaceProgress || Object.keys(updateData).length > 1) {
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update(updateData)
        .eq('id', raceState.id)

      if (updateError) {
        console.error('Error updating race state:', updateError)
        return
      }

      if (shouldUpdateTimers) {
        console.log('✅ Race state updated:', message)
      }
    }

  } catch (error) {
    console.error('Error in race loop:', error)
  }
}

function startRaceLoop() {
  if (isRaceLoopRunning) {
    console.log('⚠️ Race loop already running, skipping start')
    return
  }

  console.log('🏁 Starting race server loop with fast updates and real-time timers...')
  isRaceLoopRunning = true
  
  // Use 250ms intervals for smooth client updates, but track real seconds internally
  raceLoopInterval = setInterval(async () => {
    try {
      const startTime = Date.now()
      await updateRaceState()
      const endTime = Date.now()
      if (endTime - startTime > 100) { // Only log if update takes longer than 100ms
        console.log(`⏱️ Server update took ${endTime - startTime}ms`)
      }
    } catch (error) {
      console.error('Error in race loop:', error)
    }
  }, 250) // Fast 250ms updates for smooth client sync
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
          
        // Ensure weather conditions are present
        let finalRaceState = raceState
        if (raceState && (!raceState.weather_conditions || Object.keys(raceState.weather_conditions).length === 0)) {
          console.log('🌤️ Missing weather conditions, generating new ones...')
          const weather = generateWeatherConditions()
          
          const { data: updatedState } = await supabaseClient
            .from('race_state')
            .update({ weather_conditions: weather })
            .eq('id', raceState.id)
            .select()
            .single()
            
          finalRaceState = updatedState || raceState
          console.log('🌤️ Updated race state with weather:', weather)
        }
          
        return new Response(
          JSON.stringify({ 
            message: 'Race server status',
            running: isRaceLoopRunning,
            raceState: finalRaceState || null
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
console.log('🏇 Race server function loaded, initializing clean race state...')

// Force clean initialization on server startup
async function initializeCleanRaceState() {
  try {
    console.log('🧹 Cleaning up any existing race state...')
    
    // Delete any existing race state
    await supabaseClient
      .from('race_state')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('✅ Existing race state cleared')
    
    // Start a fresh race
    await startNewRace()
    
    console.log('🏁 Clean race state initialized - starting autonomous loop...')
    startRaceLoop()
    
  } catch (error) {
    console.error('❌ Error initializing clean race state:', error)
    // Still start the loop even if cleanup fails
    startRaceLoop()
  }
}

// Initialize clean state on startup
initializeCleanRaceState()