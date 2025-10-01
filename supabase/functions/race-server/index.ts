import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Simple horse generation function with odds calculation
function generateSimpleHorses(count: number) {
  const names = [
    'Thunder Bolt', 'Lightning Strike', 'Storm Chaser', 'Wind Runner',
    'Fire Spirit', 'Golden Arrow', 'Silver Bullet', 'Midnight Express'
  ]
  
  const horses = []
  for (let i = 0; i < count; i++) {
    const speed = Math.random() * 20 + 80
    const stamina = Math.random() * 20 + 80
    const acceleration = Math.random() * 20 + 80
    const elo = 500 + Math.floor(Math.random() * 400)
    
    // Calculate odds based on overall skill (average of speed, stamina, acceleration)
    const overallSkill = (speed + stamina + acceleration) / 3
    // Convert skill to odds (higher skill = lower odds)
    const baseOdds = Math.max(1.5, 15 - (overallSkill - 80) * 0.5)
    const odds = Math.round(baseOdds * 100) / 100 // Round to 2 decimal places
    
    horses.push({
      id: (i + 1).toString(),
      name: names[i],
      speed: speed,
      stamina: stamina,
      acceleration: acceleration,
      elo: elo,
      odds: odds,
      position: 0,
      lane: i + 1
    })
  }
  return horses
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    console.log('🚀 Race server - checking for horses...')
    
    // Check for existing race state
    const { data: currentRaceState, error: fetchError } = await supabaseClient
      .from('race_state')
      .select('*')
      .limit(1)
      .single()

    if (fetchError || !currentRaceState) {
      console.log('❌ No race state - creating with horses...')
      
      const horses = generateSimpleHorses(8)
      console.log('🏇 Generated horses:', horses.map(h => `${h.name} (${h.odds}:1)`))
      
      // Use the correct schema fields that match the database
      const { data: newRace, error: createError } = await supabaseClient
        .from('race_state')
        .insert({
          race_state: 'pre-race',
          horses: horses,
          race_progress: {},
          pre_race_timer: 10,
          race_results: []
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
        message: 'New race created with horses'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!currentRaceState.horses || currentRaceState.horses.length === 0) {
      console.log('❌ No horses - adding them...')
      
      const horses = generateSimpleHorses(8)
      
      const { error: updateError } = await supabaseClient
        .from('race_state')
        .update({ 
          horses: horses
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
        message: 'Horses added'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log('✅ Horses exist:', currentRaceState.horses.length)
    return new Response(JSON.stringify({ 
      status: 'ok', 
      horses: currentRaceState.horses.length,
      race_state: currentRaceState.race_state,
      message: 'Race server running with horses'
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