import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint } = await req.json()
    
    // Validate endpoint
    const allowedEndpoints = ['/fleet/vehicles/locations', '/fleet/vehicles', '/fleet/drivers', '/fleet/vehicles/stats'];
    const isAllowed = allowedEndpoints.some(e => endpoint.startsWith(e));
    
    if (!isAllowed) {
         return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         })
    }

    const SAMSARA_API_TOKEN = Deno.env.get('SAMSARA_API_TOKEN')
    
    if(!SAMSARA_API_TOKEN) {
         return new Response(JSON.stringify({ error: 'SAMSARA_API_TOKEN not configured in Edge Function' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         })
    }

    const samsaraUrl = `https://api.samsara.com${endpoint}`;

    const response = await fetch(samsaraUrl, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${SAMSARA_API_TOKEN}`,
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
