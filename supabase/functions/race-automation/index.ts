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
    // This function is now disabled to prevent race conflicts
    // Only update_race_tick() should handle race completion
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Race automation disabled - using update_race_tick() instead',
        note: 'This function was causing premature race endings'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Race automation error:', error)
    return new Response(
      JSON.stringify({ error: 'Race automation disabled' }),
      { 
        status: 200, // Return 200 to avoid errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})