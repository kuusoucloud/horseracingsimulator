import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('⚡ High-frequency race tick started at', new Date().toISOString())

    // Call the race tick function for high-frequency updates
    const { error: tickError } = await supabase.rpc('update_race_tick')
    
    if (tickError) {
      console.error('❌ High-frequency tick error:', tickError)
      throw tickError
    }

    console.log('✅ High-frequency race tick completed')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'High-frequency race tick completed',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ High-frequency tick error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'High-frequency tick failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})