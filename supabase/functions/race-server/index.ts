// Import the horses module for proper ELO-based generation
import { generateRandomHorses, calculateOddsFromELO } from './horses.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Generate weather conditions that match client expectations
function generateWeatherConditions() {
  // Twilight is 10% chance
  const isTwilight = Math.random() < 0.1;
  // Rain is 10% chance
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
  // Handle CORS preflight requests first
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request')
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    })
  }

  console.log(`📡 Received ${req.method} request to race-server function`)

  try {
    console.log('🚀 Race server - checking for horses...')
    
    // Check for existing race state
    const { data: currentRaceState, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .single()

    if (fetchError || !currentRaceState) {
      console.log('❌ No race state - creating with ELO-based horses...')
      
      // Use proper ELO-based horse generation
      const horses = generateRandomHorses(8)
      const weather = generateWeatherConditions()
      console.log('🏇 Generated ELO-based horses:', horses.map(h => `${h.name} (ELO: ${h.elo}, Odds: ${h.odds}:1)`))
      console.log('🌤️ Generated weather:', weather)
      
      // Use the correct schema fields that match the database
      const { data: newRace, error: createError } = await supabaseClient
        .from('race_state')
        .insert({
          race_state: 'pre-race',
          horses: horses,
          race_progress: {},
          pre_race_timer: 10,
          race_results: [],
          weather_conditions: weather
        })
        .select()
        .single()

      if (createError) {
        console.error('❌ Create error:', createError)
        return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'Create failed: ' + createError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ 
        status: 'race_created', 
        horses: horses.length,
        weather: weather,
        message: 'New race created with ELO-based horses and weather'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!currentRaceState.horses || currentRaceState.horses.length === 0) {
      console.log('❌ No horses - adding ELO-based horses...')
      
      // Use proper ELO-based horse generation
      const horses = generateRandomHorses(8)
      const weather = currentRaceState.weather_conditions || generateWeatherConditions()
      console.log('🏇 Generated ELO-based horses:', horses.map(h => `${h.name} (ELO: ${h.elo}, Odds: ${h.odds}:1)`))
      
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update({ 
          horses: horses,
          weather_conditions: weather
        })
        .eq('id', currentRaceState.id)

      if (updateError) {
        console.error('❌ Update error:', updateError)
        return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'Update failed: ' + updateError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      return new Response(JSON.stringify({ 
        status: 'horses_added', 
        horses: horses.length,
        weather: weather,
        message: 'ELO-based horses and weather added'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Check if race is finished and needs to restart
    if (currentRaceState.race_state === 'finished') {
      console.log('🔄 Race finished - starting new race with fresh ELO-based horses...')
      
      // Generate new horses for the next race
      const horses = generateRandomHorses(8)
      const weather = generateWeatherConditions()
      console.log('🏇 New race horses:', horses.map(h => `${h.name} (ELO: ${h.elo}, Odds: ${h.odds}:1)`))
      
      const { error: restartError } = await supabaseClient
        .from('race_state')
        .update({ 
          race_state: 'pre-race',
          horses: horses,
          race_progress: {},
          pre_race_timer: 10,
          countdown_timer: 0,
          race_timer: 0,
          race_results: [],
          show_photo_finish: false,
          show_results: false,
          photo_finish_results: [],
          weather_conditions: weather,
          race_start_time: null
        })
        .eq('id', currentRaceState.id)

      if (restartError) {
        console.error('❌ Restart error:', restartError)
        return new Response(JSON.stringify({ 
          status: 'error', 
          message: 'Restart failed: ' + restartError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      return new Response(JSON.stringify({ 
        status: 'race_restarted', 
        horses: horses.length,
        weather: weather,
        message: 'New race started with fresh ELO-based horses'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Ensure weather exists and has correct format
    if (!currentRaceState.weather_conditions || 
        !currentRaceState.weather_conditions.timeOfDay ||
        !currentRaceState.weather_conditions.weather ||
        !currentRaceState.weather_conditions.skyColor) {
      console.log('❌ Invalid weather - fixing it...')
      
      const weather = generateWeatherConditions()
      
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update({ 
          weather_conditions: weather
        })
        .eq('id', currentRaceState.id)

      if (updateError) {
        console.error('❌ Weather update error:', updateError)
      } else {
        console.log('🌤️ Weather fixed:', weather)
      }
    }

    console.log('✅ Horses exist:', currentRaceState.horses.length)
    return new Response(JSON.stringify({ 
      status: 'ok', 
      horses: currentRaceState.horses.length,
      race_state: currentRaceState.race_state,
      weather: currentRaceState.weather_conditions,
      message: 'Race server running with ELO-based horses and weather'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Server error:', error)
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});