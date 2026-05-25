// Vercel Serverless Function — FRED API Proxy
// Sicherheit: Origin-Auth · IP-Rate-Limiting · Series-Whitelist · Least Privilege

const https = require('https');

// ── 1. SERIES WHITELIST (Principle of Least Privilege) ───
const ALLOWED_SERIES = new Set([
  'T10Y3M',       // Yield Curve
  'VIXCLS',       // VIX
  'BAMLH0A0HYM2', // HY Spread
  'SP500',        // S&P 500
  'FEDFUNDS',     // Fed Funds Rate
  'DTWEXBGS',     // Dollar Index
  'PCOPPUSDM',    // Kupfer
  'UNRATE',       // Arbeitslosigkeit
  'CPIAUCSL',     // CPI
  'DGS10',        // 10J Treasury
  'INDPRO',       // Industrieproduktion
  'UMCSENT',      // Univ. of Michigan Consumer Sentiment
]);

// ── 2. RATE LIMITER (in-memory, per IP) ──────────────────
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

// ── 3. ORIGIN AUTH ────────────────────────────────────────
// Kein Origin-Header = same-origin Browser-Request → erlauben
// Origin von fremder Domain → blockieren
function isAllowedOrigin(req) {
  const origin = req.headers['origin'] || '';

  // Kein Origin-Header: same-origin GET-Request vom Browser → erlauben
  if (!origin) return true;

  // Vercel-Domains erlauben (inkl. Preview-URLs)
  if (origin.includes('.vercel.app')) return true;

  // Localhost für Entwicklung
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;

  // Explizit konfigurierte Custom Domain
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin.startsWith(allowed)) return true;

  // Fremde Domain → blockieren
  return false;
}

// ── HANDLER ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Nur GET erlaubt' });

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Nicht autorisiert — ungültiger Origin' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress
          || 'unknown';

  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: `Rate Limit erreicht (max ${RATE_LIMIT_MAX} Anfragen/Min)`
    });
  }

  const { series_id, limit } = req.query;

  if (!series_id) {
    return res.status(400).json({ error: 'Parameter series_id fehlt' });
  }
  if (!ALLOWED_SERIES.has(series_id)) {
    return res.status(403).json({ error: `Serie nicht erlaubt: ${series_id}` });
  }

  const safeLimit = Math.min(Math.max(parseInt(limit) || 260, 1), 500);

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'FRED_API_KEY nicht konfiguriert' });
  }

  const path = [
    '/fred/series/observations',
    `?series_id=${encodeURIComponent(series_id)}`,
    `&api_key=${apiKey}`,
    `&sort_order=desc`,
    `&limit=${safeLimit}`,
    `&file_type=json`
  ].join('');

  return new Promise((resolve) => {
    https.get({ hostname: 'api.stlouisfed.org', path }, (fredRes) => {
      let raw = '';
      fredRes.on('data', chunk => { raw += chunk; });
      fredRes.on('end', () => {
        try {
          const full = JSON.parse(raw);
          if (fredRes.statusCode !== 200) {
            res.status(fredRes.statusCode).json({
              error: full.error_message || `FRED HTTP ${fredRes.statusCode}`
            });
            return resolve();
          }
          // Least Privilege: nur date + value zurückgeben
          const observations = (full.observations || []).map(o => ({
            date:  o.date,
            value: o.value
          }));
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
