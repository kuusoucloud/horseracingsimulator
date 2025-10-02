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

    // Use the new database function that waits for all horses to finish
    const { error: tickError } = await supabase.rpc('update_race_tick')

    if (tickError) {
      throw new Error('Race tick function error: ' + tickError.message)
    }

    // Get updated race state to return status
    const { data: raceData, error: raceError } = await supabase
      .from('race_state')
      .select('race_state, timer, race_results')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const isRaceComplete = raceData?.race_state === 'photo_finish' || raceData?.race_state === 'finished'
    const finishedHorses = raceData?.race_results ? JSON.parse(raceData.race_results).length : 0

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Race tick processed - waiting for all horses to finish',
        raceState: raceData?.race_state || 'unknown',
        timer: raceData?.timer || 0,
        finishedHorses,
        raceComplete: isRaceComplete,
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