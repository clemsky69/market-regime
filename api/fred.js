// Vercel Serverless Function — FRED API Proxy
// Sicherheit: Origin-Auth · IP-Rate-Limiting · Series-Whitelist · Least Privilege

const https = require('https');

// ── 1. SERIES WHITELIST (Principle of Least Privilege) ───
// Nur diese FRED-Serien darf der Proxy abfragen — keine beliebigen Requests möglich
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
// 30 Requests pro IP pro Minute — kein Upstash/Redis nötig für diesen Use Case
const rateLimitStore = new Map();
const RATE_LIMIT_MAX    = 30;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 Minute in ms

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

// Cleanup alter Einträge alle 5 Minuten (verhindert Memory Leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 5 * 60 * 1000);

// ── 3. ORIGIN AUTH ────────────────────────────────────────
// Requests nur vom eigenen Vercel-Domain + localhost erlaubt
// ALLOWED_ORIGIN als Vercel Env-Variable setzen (z.B. https://market-regime.vercel.app)
function isAllowedOrigin(req) {
  const origin  = req.headers['origin']  || '';
  const referer = req.headers['referer'] || '';
  const source  = origin || referer;

  const allowed = process.env.ALLOWED_ORIGIN || '';

  // localhost immer erlaubt (Entwicklung)
  if (source.includes('localhost') || source.includes('127.0.0.1')) return true;

  // Vercel Preview-URLs erlauben (*.vercel.app)
  if (source.includes('.vercel.app')) return true;

  // Explizit gesetzter Origin
  if (allowed && source.startsWith(allowed)) return true;

  // Kein Origin-Header = direkter Server-Call (curl etc.) → blockieren
  if (!source) return false;

  return false;
}

// ── HANDLER ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS-Header
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Nur GET erlaubt' });

  // ── Auth: Origin prüfen ───────────────────────────────
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Nicht autorisiert — ungültiger Origin' });
  }

  // ── Rate Limiting ─────────────────────────────────────
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.socket?.remoteAddress
          || 'unknown';

  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: `Rate Limit erreicht (max ${RATE_LIMIT_MAX} Anfragen/Min) — bitte warte kurz`
    });
  }

  // ── Input Validation ──────────────────────────────────
  const { series_id, limit } = req.query;

  if (!series_id) {
    return res.status(400).json({ error: 'Parameter series_id fehlt' });
  }
  if (!ALLOWED_SERIES.has(series_id)) {
    return res.status(403).json({ error: `Serie nicht erlaubt: ${series_id}` });
  }

  // Limit auf sicheren Bereich begrenzen (max 500)
  const safeLimit = Math.min(Math.max(parseInt(limit) || 260, 1), 500);

  // ── FRED API Fetch ────────────────────────────────────
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

          // ── Least Privilege: nur date + value zurückgeben ──
          // Alle FRED-Metadaten (realtime_start, realtime_end, units etc.) strippen
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
