Deno.serve(async (req) => {
  console.log(`🧪 Test CORS function called with ${req.method}`)

  // Handle CORS preflight - MUST be first
  if (req.method === 'OPTIONS') {
    console.log('🔄 Test CORS preflight')
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      },
    })
  }

  // Standard headers for all responses
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  return new Response(
    JSON.stringify({ 
      message: 'Test CORS function working!',
      timestamp: new Date().toISOString(),
      method: req.method
    }),
    { status: 200, headers: responseHeaders }
  )
})