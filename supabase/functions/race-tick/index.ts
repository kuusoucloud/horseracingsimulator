import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current race
    const { data: raceData, error: raceError } = await supabase
      .from('race_state')
      .select('*')
      .eq('race_state', 'racing')
      .single()

    if (raceError || !raceData) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No active race',
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get horses in the race
    const { data: horses, error: horsesError } = await supabase
      .from('horses')
      .select('*')
      .in('id', raceData.horse_lineup)

    if (horsesError || !horses) {
      throw new Error('Failed to get horses: ' + horsesError?.message)
    }

    // Calculate race progress
    const raceStartTime = new Date(raceData.race_start_time).getTime()
    const now = Date.now()
    const raceDurationMs = now - raceStartTime
    const timeDeltaMs = 100 // 100ms tick

    // Update each horse position
    const updates = horses.map(horse => {
      // Calculate realistic horse speed (18-25 m/s range)
      const baseSpeed = ((horse.speed * 0.8 + horse.acceleration * 0.2) / 100.0)
      // Use horse ID for consistent speed variation
      const speedVariation = 0.85 + (((horse.id.charCodeAt(0) * 7) % 100) / 100.0 * 0.3)
      const currentVelocity = (18.0 + (baseSpeed * 7.0)) * speedVariation
      
      // Calculate new position
      const newPosition = Math.min(
        (horse.position || 0) + (currentVelocity * timeDeltaMs / 1000.0),
        1200.0
      )

      return {
        id: horse.id,
        position: newPosition,
        velocity: currentVelocity,
        updated_at: new Date().toISOString()
      }
    })

    // Update all horses
    for (const update of updates) {
      await supabase
        .from('horses')
        .update({
          position: update.position,
          velocity: update.velocity,
          updated_at: update.updated_at
        })
        .eq('id', update.id)
    }

    // Check if race is complete
    const raceComplete = updates.some(horse => horse.position >= 1200)
    
    if (raceComplete) {
      // Race complete - trigger finish
      await supabase
        .from('race_state')
        .update({
          race_state: 'photo_finish',
          race_end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('race_state', 'racing')
    } else {
      // Update race timer
      const timer = Math.max(0, 20 - Math.floor(raceDurationMs / 1000))
      await supabase
        .from('race_state')
        .update({
          timer: timer,
          updated_at: new Date().toISOString()
        })
        .eq('race_state', 'racing')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Race tick processed',
        horsesUpdated: updates.length,
        raceComplete,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Race tick error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Race tick error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})