import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🤖 Race automation tick started at', new Date().toISOString())

    // Call the race tick function to handle all race states
    const { error: tickError } = await supabase.rpc('update_race_tick')
    
    if (tickError) {
      console.error('❌ Race tick error:', tickError)
      throw tickError
    }

    console.log('✅ Race automation tick completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Race automation tick completed',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('❌ Race automation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Race automation failed',
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