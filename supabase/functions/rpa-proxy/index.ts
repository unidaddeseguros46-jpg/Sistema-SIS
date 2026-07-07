import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

let cachedUrl: string | null = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 30_000

async function getTunnelUrl(): Promise<string> {
  const now = Date.now()
  if (cachedUrl && now < cacheExpiresAt) return cachedUrl

  const { data, error } = await supabase
    .from('rpa_config')
    .select('tunnel_url')
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.error('[RPA Proxy] Error leyendo rpa_config:', error?.message)
    throw new Error('Config RPA no disponible')
  }

  cachedUrl = data.tunnel_url
  cacheExpiresAt = now + CACHE_TTL_MS
  return cachedUrl
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { endpoint, ...forwardData } = await req.json()

    if (!endpoint) {
      return new Response(JSON.stringify({ success: false, error: 'Falta el campo "endpoint"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const target = await getTunnelUrl()

    const response = await fetch(`${target}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardData),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[RPA Proxy] ${response.status} /${endpoint}: ${text}`)
      return new Response(JSON.stringify({
        success: false,
        error: `El servicio RPA respondió con código ${response.status}`,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const responseData = await response.json()
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[RPA Proxy] Error:', err.message)
    return new Response(JSON.stringify({
      success: false,
      error: 'Error de conexión con el servicio RPA',
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
