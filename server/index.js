/* ============================================================
   PulseGrid API Server
   Express + scheduled data pipelines + in-memory cache
   ============================================================ */
const express       = require('express');
const cors          = require('cors');
const compression   = require('compression');
const cron          = require('node-cron');
const { pipeline }  = require('./pipeline');
const { cache }     = require('./cache');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ---- Middleware ---- */
app.use(cors());
app.use(compression());
app.use(express.json());

/* ---- Root route ---- */
app.get('/', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PulseGrid API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      padding: 2rem;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { max-width: 800px; }
    h1 { font-size: 3rem; margin-bottom: 0.5rem; }
    .subtitle { font-size: 1.2rem; opacity: 0.9; margin-bottom: 2rem; }
    .endpoints { 
      background: rgba(255,255,255,0.1); 
      backdrop-filter: blur(10px);
      border-radius: 12px; 
      padding: 2rem; 
      margin: 2rem 0;
    }
    .endpoint { 
      margin: 1rem 0; 
      padding: 1rem; 
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      font-family: 'Courier New', monospace;
    }
    .method { 
      color: #ffd700; 
      font-weight: 700; 
      margin-right: 0.5rem;
    }
    .path { color: #fff; }
    .desc { 
      margin-top: 0.5rem; 
      font-size: 0.9rem; 
      opacity: 0.8;
      font-family: sans-serif;
    }
    a { color: #ffd700; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .status { 
      display: inline-block;
      padding: 0.3rem 0.8rem;
      background: rgba(0,255,0,0.2);
      border-radius: 20px;
      font-size: 0.85rem;
      margin-left: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 PulseGrid API</h1>
    <p class="subtitle">Economic Intelligence Backend <span class="status">✓ ONLINE</span></p>
    
    <div class="endpoints">
      <h2 style="margin-bottom: 1.5rem;">Available Endpoints</h2>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/health</span></div>
        <div class="desc">Server health check and cache statistics</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/wb/:country/:indicator?from=&to=</span></div>
        <div class="desc">Fetch World Bank data for a country/indicator (cached)</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/wb/:country/multi?indicators=X,Y&from=&to=</span></div>
        <div class="desc">Fetch multiple indicators for one country</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/countries</span></div>
        <div class="desc">List all available countries from World Bank</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/recession/:country</span></div>
        <div class="desc">Calculate recession probability using CLI model</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">POST</span><span class="path">/api/analyses</span></div>
        <div class="desc">Save an analysis (body: {country, indicator, notes})</div>
      </div>
      
      <div class="endpoint">
        <div><span class="method">GET</span><span class="path">/api/analyses</span></div>
        <div class="desc">Retrieve saved analyses</div>
      </div>
    </div>
    
    <p style="opacity: 0.8;">
      Frontend: <a href="https://pulsegrid-app.netlify.app" target="_blank">https://pulsegrid-app.netlify.app</a><br>
      GitHub: <a href="https://github.com/edoh-Onuh/pulsegrid" target="_blank">edoh-Onuh/pulsegrid</a>
    </p>
  </div>
</body>
</html>
  `);
});

/* ---- Health ---- */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cacheSize: cache.size(),
    lastPipelineRun: cache.get('__lastPipeline') || null,
  });
});

/* ---- World Bank proxy with cache ---- */
app.get('/api/wb/:country/:indicator', async (req, res) => {
  const { country, indicator } = req.params;
  const from = req.query.from || 1960;
  const to   = req.query.to   || new Date().getFullYear();
  const key  = `wb:${country}:${indicator}:${from}:${to}`;

  const cached = cache.get(key);
  if (cached) return res.json({ source: 'cache', data: cached });

  try {
    const data = await pipeline.fetchWorldBank(country, indicator, from, to);
    cache.set(key, data, 6 * 3600 * 1000); // 6h TTL
    res.json({ source: 'api', data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---- Multi-indicator ---- */
app.get('/api/wb/:country/multi', async (req, res) => {
  const { country }  = req.params;
  const indicators   = (req.query.indicators || '').split(',').filter(Boolean);
  const from         = req.query.from || 1980;
  const to           = req.query.to   || new Date().getFullYear();

  if (!indicators.length) return res.status(400).json({ error: 'No indicators' });

  try {
    const results = await Promise.all(
      indicators.map(ind => pipeline.fetchWorldBank(country, ind, from, to)
        .then(data => ({ indicator: ind, data })))
    );
    res.json({ source: 'api', results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---- Countries list ---- */
app.get('/api/countries', async (_req, res) => {
  const cached = cache.get('countries');
  if (cached) return res.json({ source: 'cache', data: cached });

  try {
    const data = await pipeline.fetchCountries();
    cache.set('countries', data, 24 * 3600 * 1000); // 24h
    res.json({ source: 'api', data });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---- Recession assessment ---- */
app.get('/api/recession/:country', async (req, res) => {
  const { country } = req.params;
  const key = `recession:${country}`;

  const cached = cache.get(key);
  if (cached) return res.json({ source: 'cache', ...cached });

  try {
    const result = await pipeline.assessRecession(country);
    cache.set(key, result, 3 * 3600 * 1000); // 3h
    res.json({ source: 'api', ...result });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---- Saved analyses (in-memory for demo) ---- */
const savedAnalyses = new Map();

app.post('/api/analyses', (req, res) => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const analysis = { id, createdAt: new Date().toISOString(), ...req.body };
  savedAnalyses.set(id, analysis);
  res.status(201).json(analysis);
});

app.get('/api/analyses', (_req, res) => {
  res.json(Array.from(savedAnalyses.values()).slice(-50));
});

app.get('/api/analyses/:id', (req, res) => {
  const a = savedAnalyses.get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
});

/* ---- Scheduled pipeline: warm cache for top 10 countries ---- */
const TOP_COUNTRIES = ['USA','GBR','CHN','IND','DEU','JPN','BRA','NGA','ZAF','AUS'];
const KEY_INDICATORS = ['NY.GDP.MKTP.CD','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG'];

cron.schedule('0 */6 * * *', async () => {
  console.log('[Pipeline] Warming cache...');
  const year = new Date().getFullYear();
  for (const c of TOP_COUNTRIES) {
    for (const ind of KEY_INDICATORS) {
      try {
        const data = await pipeline.fetchWorldBank(c, ind, 2000, year);
        cache.set(`wb:${c}:${ind}:2000:${year}`, data, 6 * 3600 * 1000);
      } catch { /* skip */ }
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
  cache.set('__lastPipeline', new Date().toISOString());
  console.log('[Pipeline] Cache warmed');
});

/* ---- Start ---- */
app.listen(PORT, () => {
  console.log(`\n  PulseGrid API listening on http://localhost:${PORT}`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /api/health`);
  console.log(`    GET  /api/wb/:country/:indicator?from=&to=`);
  console.log(`    GET  /api/wb/:country/multi?indicators=X,Y&from=&to=`);
  console.log(`    GET  /api/countries`);
  console.log(`    GET  /api/recession/:country`);
  console.log(`    POST /api/analyses`);
  console.log(`    GET  /api/analyses\n`);
});
