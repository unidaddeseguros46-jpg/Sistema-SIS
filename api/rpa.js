const TARGET = 'https://lens-answers-accidents-emerald.trycloudflare.com';

module.exports = async function handler(req, res) {
  const path = req.url.replace('/api/rpa', '') || '/';

  try {
    const response = await fetch(TARGET + path, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[RPA Proxy] ${response.status} desde ${TARGET + path}: ${text}`);
      return res.status(response.status).json({
        success: false,
        error: `El servicio RPA respondió con código ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[RPA Proxy] Error de conexión:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Error de conexión con el servicio RPA',
    });
  }
};
