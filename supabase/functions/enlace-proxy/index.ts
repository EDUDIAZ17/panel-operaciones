// supabase/functions/enlace-proxy/index.ts
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
    const { endpoint, method = 'GET', body = null } = await req.json()
    
    // Read Enlace config from environment variables
    const ENLACE_API_KEY = Deno.env.get('ENLACE_API_KEY');
    const ENLACE_REFERER = Deno.env.get('ENLACE_REFERER');
    const ENLACE_CLIENT_ID = Deno.env.get('ENLACE_CLIENT_ID');
    const ENLACE_USER_ID = Deno.env.get('ENLACE_USER_ID');
    const ENLACE_BASE_URL = Deno.env.get('ENLACE_BASE_URL') || 'https://telemetry.dev.api.enlacefl.com';

    if (!ENLACE_API_KEY || !ENLACE_REFERER || !ENLACE_CLIENT_ID || !ENLACE_USER_ID) {
         return new Response(JSON.stringify({ error: 'Enlace credentials (ENLACE_API_KEY, ENLACE_REFERER, ENLACE_CLIENT_ID, ENLACE_USER_ID) not fully configured in Edge Function' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         })
    }

    // Construct Enlace URL
    // Ensure endpoint has leading slash
    const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Check if endpoint is allowed
    const allowedPatterns = ['/current-position', '/position-history', '/closed-trips', '/assets/current-position', '/assets/position-history'];
    const isAllowed = allowedPatterns.some(pat => sanitizedEndpoint.includes(pat));
    
    if (!isAllowed) {
         return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         })
    }

    let enlaceUrl = `${ENLACE_BASE_URL}/clients/${ENLACE_CLIENT_ID}/users/${ENLACE_USER_ID}${sanitizedEndpoint}`;
    
    // Add key to query params
    const urlObj = new URL(enlaceUrl);
    urlObj.searchParams.set('key', ENLACE_API_KEY);
    
    console.log(`📡 [Enlace Proxy] Forwarding request to: ${urlObj.origin}${urlObj.pathname}`);

    const response = await fetch(urlObj.toString(), {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Referer': ENLACE_REFERER,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
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
