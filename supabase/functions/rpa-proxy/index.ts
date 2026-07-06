const TARGET = 'https://lens-answers-accidents-emerald.trycloudflare.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { endpoint, ...forwardData } = await req.json();

    if (!endpoint) {
      return new Response(JSON.stringify({ success: false, error: 'Falta el campo "endpoint"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${TARGET}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardData),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[RPA Proxy] ${response.status} /${endpoint}: ${text}`);
      return new Response(JSON.stringify({
        success: false,
        error: `El servicio RPA respondió con código ${response.status}`,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseData = await response.json();
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[RPA Proxy] Error:', err.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error de conexión con el servicio RPA',
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
