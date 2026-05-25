// Vercel Serverless Function — FRED API Proxy
// Schutz: IP-Rate-Limiting + Series-Whitelist (kein Origin-Check nötig,
// da FRED_API_KEY serverseitig gespeichert ist)

const https = require('https');

// ── SERIES WHITELIST ──────────────────────────────────────
const ALLOWED_SERIES = new Set([
  'T10Y3M',   // Yield Curve
  'VIXCLS',   // VIX (© CBOE, Citation Required)
  'NFCI',     // Chicago Fed National Financial Conditions Index
  'STLFSI4',  // St. Louis Fed Financial Stress Index
  'FEDFUNDS', // Fed Funds Rate
  'DTWEXBGS', // Dollar Index
  'PCOPPUSDM',// Kupfer
  'UNRATE',   // Arbeitslosigkeit
  'CPIAUCSL', // CPI
  'DGS10',    // 10J Treasury
  'INDPRO',   // Industrieproduktion
  'UMCSENT',  // Univ. of Michigan Consumer Sentiment
]);

// ── RATE LIMITER (in-memory, per IP) ─────────────────────
const rateLimitStore = new Map();
const RATE_LIMIT_MAX    = 30;
const RATE_LIMIT_WINDOW = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

// ── HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Nur GET erlaubt' });

  // Rate Limiting
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate Limit — bitte 1 Minute warten' });
  }

  // Input Validation
  const { series_id, limit } = req.query;
  if (!series_id)                    return res.status(400).json({ error: 'series_id fehlt' });
  if (!ALLOWED_SERIES.has(series_id)) return res.status(403).json({ error: 'Serie nicht erlaubt: ' + series_id });

  const safeLimit = Math.min(Math.max(parseInt(limit) || 260, 1), 500);

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'FRED_API_KEY nicht konfiguriert' });

  const path = '/fred/series/observations'
    + '?series_id=' + encodeURIComponent(series_id)
    + '&api_key='   + apiKey
    + '&sort_order=desc'
    + '&limit='     + safeLimit
    + '&file_type=json';

  return new Promise((resolve) => {
    https.get({ hostname: 'api.stlouisfed.org', path }, (fredRes) => {
      let raw = '';
      fredRes.on('data', chunk => { raw += chunk; });
      fredRes.on('end', () => {
        try {
          const full = JSON.parse(raw);
          if (fredRes.statusCode !== 200) {
            res.status(fredRes.statusCode).json({ error: full.error_message || 'FRED HTTP ' + fredRes.statusCode });
            return resolve();
          }
          // Least Privilege: nur date + value zurückgeben
          const observations = (full.observations || []).map(o => ({ date: o.date, value: o.value }));
          res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
          res.status(200).json({ observations });
        } catch (e) {
          res.status(500).json({ error: 'Parse-Fehler: ' + e.message });
        }
        resolve();
      });
    }).on('error', (e) => {
      res.status(500).json({ error: 'HTTPS-Fehler: ' + e.message });
      resolve();
    });
  });
};
