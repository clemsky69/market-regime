// Vercel Serverless Function — FRED API Proxy
// Nutzt Node.js https-Modul statt fetch (kompatibel mit Node 16 + 18)

const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { series_id, limit = 260 } = req.query;
  if (!series_id) return res.status(400).json({ error: 'series_id fehlt' });

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'FRED_API_KEY nicht gesetzt' });

  const path = `/fred/series/observations?series_id=${encodeURIComponent(series_id)}&api_key=${apiKey}&sort_order=asc&limit=${encodeURIComponent(limit)}&file_type=json`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.stlouisfed.org',
      path: path,
      method: 'GET',
    };

    const req2 = https.request(options, (fredRes) => {
      let raw = '';
      fredRes.on('data', chunk => raw += chunk);
      fredRes.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (fredRes.statusCode !== 200) {
            res.status(fredRes.statusCode).json({ error: data.error_message || 'FRED Fehler' });
          } else {
            res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
            res.status(200).json(data);
          }
        } catch (e) {
          res.status(500).json({ error: 'JSON Parse Fehler: ' + e.message });
        }
        resolve();
      });
    });

    req2.on('error', (e) => {
      res.status(500).json({ error: 'HTTPS Fehler: ' + e.message });
      resolve();
    });

    req2.end();
  });
};
