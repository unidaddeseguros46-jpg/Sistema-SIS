const TARGET = 'https://lens-answers-accidents-emerald.trycloudflare.com';

module.exports = async function handler(req, res) {
  const { endpoint, ...forwardData } = req.body || {};

  if (!endpoint) {
    return res.status(400).json({
      success: false,
      error: 'Falta el campo "endpoint" en el cuerpo de la petición',
    });
  }

  try {
    const response = await fetch(`${TARGET}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardData),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[RPA Proxy] ${response.status} /${endpoint}: ${text}`);
      return res.status(response.status).json({
        success: false,
        error: `El servicio RPA respondió con código ${response.status}`,
      });
    }

    const responseData = await response.json();
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('[RPA Proxy] Error de conexión:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Error de conexión con el servicio RPA',
    });
  }
};
