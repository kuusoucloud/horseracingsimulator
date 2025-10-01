const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  console.log(`🧪 CORS test called with ${req.method}`)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight request')
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    console.log('✅ Handling actual request')
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'CORS test successful!',
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: Object.fromEntries(req.headers.entries())
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ CORS test error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'CORS test error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})