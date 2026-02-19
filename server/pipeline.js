/* ============================================================
   Data Pipeline — World Bank API fetcher with retry
   ============================================================ */
const https = require('https');

const WB_BASE = 'https://api.worldbank.org/v2';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON from World Bank')); }
      });
    }).on('error', reject)
      .on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await httpGet(url); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchWorldBank(country, indicator, from, to) {
  const url = `${WB_BASE}/country/${country}/indicator/${indicator}?date=${from}:${to}&format=json&per_page=500`;
  const raw = await fetchWithRetry(url);
  if (!raw || !raw[1]) return [];

  return raw[1]
    .filter(d => d.value !== null)
    .map(d => ({ year: +d.date, value: +d.value }))
    .sort((a, b) => a.year - b.year);
}

async function fetchCountries() {
  const url = `${WB_BASE}/country?format=json&per_page=300`;
  const raw = await fetchWithRetry(url);
  if (!raw || !raw[1]) return [];

  return raw[1]
    .filter(c => c.region && c.region.id !== 'NA')
    .map(c => ({ code: c.id, name: c.name, region: c.region.value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const RECESSION_INDICATORS = [
  { code: 'NY.GDP.MKTP.KD.ZG', weight: 0.30 },
  { code: 'SL.UEM.TOTL.ZS',    weight: 0.20 },
  { code: 'FP.CPI.TOTL.ZG',    weight: 0.15 },
  { code: 'NE.EXP.GNFS.ZS',    weight: 0.15 },
  { code: 'BX.KLT.DINV.WD.GD.ZS', weight: 0.10 },
  { code: 'GC.DOD.TOTL.GD.ZS', weight: 0.10 },
];

async function assessRecession(country) {
  const year = new Date().getFullYear();
  const results = await Promise.all(
    RECESSION_INDICATORS.map(async (ind) => {
      try {
        const data = await fetchWorldBank(country, ind.code, year - 20, year);
        return { indicator: ind.code, weight: ind.weight, data };
      } catch {
        return { indicator: ind.code, weight: ind.weight, data: [] };
      }
    })
  );

  let totalWeight = 0;
  let totalSignal = 0;
  const signals = [];

  for (const r of results) {
    if (r.data.length < 3) continue;
    const recent = r.data.slice(-3).map(d => d.value);
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const allAvg = r.data.reduce((s, d) => s + d.value, 0) / r.data.length;
    const deviation = Math.abs(avg - allAvg) / (allAvg || 1);
    const signal = Math.min(deviation, 1);
    totalWeight += r.weight;
    totalSignal += signal * r.weight;
    signals.push({ indicator: r.indicator, signal: +(signal * 100).toFixed(1), weight: r.weight });
  }

  const probability = totalWeight > 0 ? +((totalSignal / totalWeight) * 100).toFixed(1) : 0;
  const riskLevel = probability > 70 ? 'severe' : probability > 50 ? 'high' : probability > 30 ? 'medium' : 'low';

  return { probability, riskLevel, signals, country };
}

module.exports = { pipeline: { fetchWorldBank, fetchCountries, assessRecession } };
