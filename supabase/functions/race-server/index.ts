import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateRandomHorses, calculateOddsFromELO } from './horses.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log(`📡 Race server called with ${req.method}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check for existing race
    const { data: existingRace } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    // If no race or race finished, create new one
    if (!existingRace || existingRace.race_state === 'finished') {
      console.log('🏇 Creating new race...')
      
      const newHorses = generateRandomHorses(8).map((horse, index) => ({
        ...horse,
        odds: calculateOddsFromELO(horse.elo),
        position: 0,
        lane: index + 1,
        finishTime: null,
        placement: null
      }))
      
      const weatherConditions = {
        timeOfDay: "day",
        weather: "clear", 
        skyColor: "#87ceeb",
        ambientIntensity: 0.4,
        directionalIntensity: 1.0,
        trackColor: "#8B4513",
        grassColor: "#32cd32"
      }

      const newRaceData = {
        race_state: 'pre-race',
        horses: newHorses,
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

      // Delete old race if exists
      if (existingRace) {
        await supabaseClient.from('race_state').delete().eq('id', existingRace.id)
      }

      // Insert new race
      const { data: newRace, error } = await supabaseClient
        .from('race_state')
        .insert([newRaceData])
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to create race:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to create race', details: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('✅ New race created successfully')
      return new Response(
        JSON.stringify({ 
          message: 'New race created successfully',
          race_id: newRace.id,
          horses: newHorses.length,
          state: 'pre-race'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      console.log('🏇 Race already exists')
      return new Response(
        JSON.stringify({ 
          message: 'Race already exists',
          race_id: existingRace.id,
          state: existingRace.race_state
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('❌ Race server error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})