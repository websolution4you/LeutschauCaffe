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
    const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const PLACE_ID = 'ChIJfbEMulpGPkcR8X3JnPbJE74';
    
    if (!GOOGLE_KEY) {
      throw new Error('GOOGLE_MAPS_API_KEY is not set');
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews&language=sk&key=${GOOGLE_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google API error: ${data.status} - ${data.error_message || ''}`);
    }

    // Vrátime len recenzie
    return new Response(JSON.stringify(data.result.reviews || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
