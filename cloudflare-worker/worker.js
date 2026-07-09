/**
 * Cloudflare Worker — DNI Birth Date Lookup
 * Hospital San José
 * 
 * Endpoint: POST /
 * Body: { "dni": "12345678" }
 * Response: { "success": true, "fecha_nac": "06/05/2004", "fecha_iso": "2004-05-06" }
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const { dni } = await request.json();

      if (!dni || !/^\d{8}$/.test(dni)) {
        return new Response(
          JSON.stringify({ success: false, error: "DNI inválido. Debe contener exactamente 8 dígitos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Consulta a la API externa (WordPress AJAX)
      const formData = new URLSearchParams();
      formData.append("dni", dni);
      formData.append("action", "consulta_dni_api");
      formData.append("tipo", "dni");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch("https://buscardniperu.com/wp-admin/admin-ajax.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://buscardniperu.com/como-saber-la-edad-por-dni/",
        },
        body: formData.toString(),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            errorType: 'SOURCE_DOWN',
            error: "El servicio de DNI Perú se encuentra temporalmente inaccesible (Error " + response.status + ")" 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await response.json();

      if (result.success && result.data && result.data.fecha_nac) {
        // Fecha viene como "yyyy-mm-dd" → convertir a "dd/mm/yyyy" para el frontend
        const [year, month, day] = result.data.fecha_nac.split("-");
        const fechaVisual = `${day}/${month}/${year}`;

        return new Response(
          JSON.stringify({
            success: true,
            fecha_nac: fechaVisual,      // dd/mm/yyyy → para el campo visual
            fecha_iso: result.data.fecha_nac, // yyyy-mm-dd → para la BD
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            errorType: 'NOT_FOUND',
            error: "No se encontró información para el DNI proporcionado." 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (error) {
      const isNetworkError = error.name === 'AbortError' || error.message.includes('fetch failed');
      return new Response(
        JSON.stringify({ 
          success: false, 
          errorType: isNetworkError ? 'NETWORK_TIMEOUT' : 'INTERNAL_ERROR',
          error: isNetworkError 
            ? "Tiempo de espera agotado al conectar con el servidor de DNI." 
            : "Error interno: " + error.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
