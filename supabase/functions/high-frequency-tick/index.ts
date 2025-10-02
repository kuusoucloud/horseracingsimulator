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
    // This function is now disabled to prevent race conflicts
    // Only update_race_tick() should handle race completion
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'High-frequency tick disabled - using update_race_tick() instead',
        note: 'This function was causing premature race endings',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('High-frequency tick disabled:', error)
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'High-frequency tick disabled'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})