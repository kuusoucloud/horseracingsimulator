import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateRandomHorses, calculateOddsFromELO } from './horses.ts'

// Generate weather conditions that match client expectations
function generateWeatherConditions() {
  const isTwilight = Math.random() < 0.1;
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

Deno.serve(async (req) => {
  console.log(`📡 Received ${req.method} request`)

  // Handle CORS preflight - MUST be first
  if (req.method === 'OPTIONS') {
    console.log('🔄 CORS preflight')
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

    // Check for existing race state
    const { data: existingRace, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error fetching race state:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch race state', details: fetchError.message }),
        { status: 500, headers: responseHeaders }
      )
    }

    // If no race exists or race is finished, create a new one
    if (!existingRace || existingRace.race_state === 'finished') {
      console.log('🏇 Creating new race...')
      
      // Generate new horses with ELO ratings and proper initialization
      const newHorses = generateRandomHorses(8)
      const horsesWithOdds = newHorses.map((horse, index) => ({
        ...horse,
        odds: calculateOddsFromELO(horse.elo),
        position: 0, // Ensure position starts at 0
        lane: index + 1,
        finishTime: null,
        placement: null
      }))
      
      // Generate weather conditions
      const weatherConditions = generateWeatherConditions()
      
      console.log('🏇 Generated horses:', horsesWithOdds.map(h => `${h.name} (ELO: ${h.elo}, Odds: ${h.odds})`))

      // Create new race state
      const newRaceData = {
        race_state: 'pre-race' as const,
        horses: horsesWithOdds,
        race_progress: {},
        pre_race_timer: 10,
        countdown_timer: 0,
        race_timer: 0,
        race_start_time: null,
        race_results: [],
        show_photo_finish: false,
        show_results: false,
        photo_finish_results: [],
        weather_conditions: weatherConditions,
        timer_owner: 'server'
      }

      // Delete old race state if it exists
      if (existingRace) {
        await supabaseClient
          .from('race_state')
          .delete()
          .eq('id', existingRace.id)
      }

      // Insert new race state
      const { data: newRace, error: insertError } = await supabaseClient
        .from('race_state')
        .insert([newRaceData])
        .select()
        .single()

      if (insertError) {
        console.error('❌ Error creating new race:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create new race', details: insertError.message }),
          { status: 500, headers: responseHeaders }
        )
      }

      console.log('✅ New race created successfully:', newRace.id)
      
      return new Response(
        JSON.stringify({ 
          message: 'New race created successfully',
          race_id: newRace.id,
          horses: horsesWithOdds.length,
          weather: weatherConditions,
          state: 'pre-race',
          timer: 10
        }),
        { status: 200, headers: responseHeaders }
      )
    } else {
      console.log('🏇 Race already exists:', existingRace.race_state)
      
      return new Response(
        JSON.stringify({ 
          message: 'Race already exists',
          race_id: existingRace.id,
          state: existingRace.race_state,
          timer: existingRace.pre_race_timer
        }),
        { status: 200, headers: responseHeaders }
      )
    }

  } catch (error) {
    console.error('❌ Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: responseHeaders }
    )
  }
})