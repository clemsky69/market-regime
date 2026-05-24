// Vercel Serverless Function — FRED API Proxy
// Umgeht CORS-Einschränkungen der FRED API für Browser-Anfragen.
// FRED_API_KEY muss als Umgebungsvariable in den Vercel-Projekteinstellungen gesetzt sein.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { series_id, limit = 260 } = req.query;

  if (!series_id) {
    return res.status(400).json({ error: 'series_id Parameter fehlt' });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'FRED_API_KEY nicht gesetzt — bitte in Vercel Environment Variables eintragen' });
  }

  const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(series_id)}&api_key=${apiKey}&sort_order=desc&limit=${encodeURIComponent(limit)}&file_type=json`;

  try {
    const response = await fetch(fredUrl);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error_message || `FRED HTTP ${response.status}`
      });
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy-Fehler: ' + err.message });
  }
};
