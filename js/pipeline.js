/* ============================================================
   PulseGrid — Pipeline Module
   World Bank API client · IndexedDB cache · ETL data engine
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ── Metrics counters ────────────────────────────────────── */
PG.metrics = { requests: 0, nulls: 0, models: 0, charts: 0 };

/* ── Constants ───────────────────────────────────────────── */
const API_BASE   = 'https://api.worldbank.org/v2';
const CACHE_NAME = 'pulsegrid-v1';
const CACHE_TTL  = 21600 * 1000; // 6 h (fresher live data)
const MAX_RETRY  = 3;
const RETRY_DELAY_MS = 1200;
const CURRENT_YEAR = new Date().getFullYear();

/* Indicator catalogue */
PG.INDICATORS = {
  'NY.GDP.MKTP.CD':    'GDP (Current USD)',
  'NY.GDP.MKTP.KD.ZG': 'GDP Growth (%)',
  'NY.GDP.PCAP.CD':    'GDP per Capita (USD)',
  'FP.CPI.TOTL.ZG':   'Inflation Rate (%)',
  'SL.UEM.TOTL.ZS':   'Unemployment (%)',
  'NE.EXP.GNFS.ZS':   'Exports (% of GDP)',
  'NE.IMP.GNFS.ZS':   'Imports (% of GDP)',
  'BX.KLT.DINV.WD.GD.ZS': 'FDI Net Inflows (% GDP)',
  'GC.DOD.TOTL.GD.ZS': 'Government Debt (% GDP)',
  'SP.POP.TOTL':       'Total Population',
  'SE.ADT.LITR.ZS':   'Adult Literacy Rate (%)',
  'SH.XPD.CHEX.GD.ZS':'Health Expenditure (% GDP)',
  'EN.ATM.CO2E.PC':   'CO₂ Emissions (t per capita)',
  'EG.USE.ELEC.KH.PC':'Electric Power Consumption',
  'IT.NET.USER.ZS':   'Internet Users (%)',
};
/* \u2500\u2500 Offline detection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
PG.isOnline = function() { return navigator.onLine !== false; };

window.addEventListener('online',  () => {
  updateAPIStatus('online');
  PG.log('Connection restored', 'success');
});
window.addEventListener('offline', () => {
  updateAPIStatus('error');
  PG.log('Connection lost \u2014 cached data still available', 'warn');
});
/* ── IndexedDB helper ────────────────────────────────────── */
let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        const store = db.createObjectStore('cache', { keyPath: 'key' });
        store.createIndex('expires', 'expires');
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

async function cacheGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx   = db.transaction('cache', 'readonly');
      const req  = tx.objectStore('cache').get(key);
      req.onsuccess = () => {
        const rec = req.result;
        if (!rec) { resolve(null); return; }
        if (Date.now() > rec.expires) { cacheDelete(key); resolve(null); return; }
        resolve(rec.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function cacheSet(key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put({ key, data, expires: Date.now() + CACHE_TTL });
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
  } catch { /* silent */ }
}

async function cacheDelete(key) {
  try {
    const db = await openDB();
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').delete(key);
  } catch { /* silent */ }
}

/* Clear stale entries on init */
async function purgeExpired() {
  try {
    const db  = await openDB();
    const tx  = db.transaction('cache', 'readwrite');
    const idx = tx.objectStore('cache').index('expires');
    const now = Date.now();
    const req = idx.openCursor(IDBKeyRange.upperBound(now));
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch { /* silent */ }
}

/* ── Log helper ──────────────────────────────────────────── */
PG.log = function(msg, level = 'info') {
  const logEl = document.getElementById('pipeline-log');
  if (!logEl) return;
  const ts  = new Date().toTimeString().slice(0, 8);
  const div = document.createElement('div');
  div.className = `log-entry log-${level}`;
  div.innerHTML = `<span class="log-ts">[${ts}]</span>${msg}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
};

/* ── Fetch single World Bank page ────────────────────────── */
async function fetchPage(url, attempt = 1) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < MAX_RETRY) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return fetchPage(url, attempt + 1);
    }
    throw err;
  }
}

/* ── Main World Bank fetch (paginated) ───────────────────── */
PG.fetchWorldBank = async function(countryCode, indicatorCode, fromYear = 1990, toYear = CURRENT_YEAR) {
  const key = `wb_${countryCode}_${indicatorCode}_${fromYear}_${toYear}`;

  // Try cache
  const cached = await cacheGet(key);
  if (cached) {
    PG.log(`Cache hit: ${countryCode} / ${PG.INDICATORS[indicatorCode] || indicatorCode}`, 'success');
    return cached;
  }

  PG.metrics.requests++;
  updateMetricEl('pm-requests', PG.metrics.requests);
  PG.log(`Fetching: ${countryCode} / ${PG.INDICATORS[indicatorCode] || indicatorCode} (${fromYear}–${toYear})`, 'info');
  // Early offline guard \u2014 check before making network requests
  if (!PG.isOnline()) {
    updateAPIStatus('error');
    PG.log('Network offline \u2014 cannot fetch live data', 'error');
    throw new Error('No network connection. Please check your internet and try again.');
  }
  updateAPIStatus('loading');

  const url = `${API_BASE}/country/${countryCode}/indicator/${indicatorCode}`
    + `?format=json&per_page=500&date=${fromYear}:${toYear}&source=2`;

  let allData = [];
  try {
    const [meta, data] = await fetchPage(url);
    if (!Array.isArray(data)) throw new Error('Empty dataset');
    allData = data;

    // Handle pagination
    if (meta.pages > 1) {
      const pages = [];
      for (let p = 2; p <= Math.min(meta.pages, 5); p++) {
        pages.push(fetchPage(url + `&page=${p}`));
      }
      const results = await Promise.all(pages);
      results.forEach(([, d]) => { if (Array.isArray(d)) allData = allData.concat(d); });
    }

    const normalised = PG.normalise(allData, indicatorCode);
    await cacheSet(key, normalised);
    updateAPIStatus('online');
    PG.log(`Loaded ${normalised.length} datapoints`, 'success');
    return normalised;

  } catch (err) {
    updateAPIStatus('error');
    PG.log(`Fetch error: ${err.message}`, 'error');
    throw err;
  }
};

/* ── Normalise World Bank response ──────────────────────── */
PG.normalise = function(raw, indicatorCode) {
  if (!Array.isArray(raw)) return [];

  const series = raw
    .filter(d => d && d.date && d.value !== undefined)
    .map(d => ({ year: parseInt(d.date, 10), value: d.value }))
    .sort((a, b) => a.year - b.year);

  // Count nulls
  const nullCount = series.filter(d => d.value === null).length;
  PG.metrics.nulls += nullCount;
  updateMetricEl('pm-nulls', PG.metrics.nulls);
  if (nullCount) PG.log(`Interpolating ${nullCount} null values`, 'warn');

  // Interpolate
  return PG.interpolate(series);
};

/* ── Linear interpolation for null gaps ─────────────────── */
PG.interpolate = function(series) {
  const arr = series.map(d => ({ ...d }));
  const n   = arr.length;

  for (let i = 0; i < n; i++) {
    if (arr[i].value !== null) continue;

    // Find prev valid
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (arr[j].value !== null) { prev = j; break; }
    }
    // Find next valid
    let next = null;
    for (let j = i + 1; j < n; j++) {
      if (arr[j].value !== null) { next = j; break; }
    }

    if (prev !== null && next !== null) {
      const span = arr[next].year - arr[prev].year;
      const diff = arr[next].value - arr[prev].value;
      arr[i].value = arr[prev].value + diff * ((arr[i].year - arr[prev].year) / span);
    } else if (prev !== null) {
      arr[i].value = arr[prev].value;
    } else if (next !== null) {
      arr[i].value = arr[next].value;
    }
  }
  return arr;
};

/* ── Fetch all countries ─────────────────────────────────── */
PG.fetchCountries = async function() {
  const key = 'wb_countries_all';
  const cached = await cacheGet(key);
  if (cached) return cached;

  PG.log('Fetching country list from World Bank…', 'info');
  try {
    const [meta, data] = await fetchPage(
      `${API_BASE}/country?format=json&per_page=300`
    );
    if (!Array.isArray(data)) throw new Error('No country data');

    // Filter to proper countries (not aggregates), sort alphabetically
    const countries = data
      .filter(c => c.region && c.region.id !== 'NA')
      .map(c => ({ code: c.id, name: c.name, region: c.region?.value || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    await cacheSet(key, countries);
    PG.log(`Loaded ${countries.length} countries`, 'success');
    return countries;
  } catch (err) {
    PG.log(`Country fetch error: ${err.message}`, 'error');
    // Return fallback list
    return PG.FALLBACK_COUNTRIES;
  }
};

/* ── Fetch multiple indicators for correlation ───────────── */
PG.fetchMultiIndicator = async function(countryCode, indicatorCodes, fromYear, toYear) {
  PG.log(`Fetching ${indicatorCodes.length} indicators for ${countryCode}…`, 'info');
  const fetches = indicatorCodes.map(ind => PG.fetchWorldBank(countryCode, ind, fromYear, toYear));
  const results = await Promise.allSettled(fetches);
  return results.map((r, i) => ({
    indicator: indicatorCodes[i],
    label: PG.INDICATORS[indicatorCodes[i]] || indicatorCodes[i],
    data: r.status === 'fulfilled' ? r.value : [],
  }));
};

/* ── Fetch same indicator for multiple countries ─────────── */
PG.fetchMultiCountry = async function(countryCodes, indicatorCode, fromYear, toYear) {
  PG.log(`Fetching ${indicatorCode} for ${countryCodes.length} countries…`, 'info');
  const fetches = countryCodes.map(c => PG.fetchWorldBank(c, indicatorCode, fromYear, toYear));
  const results = await Promise.allSettled(fetches);
  return results.map((r, i) => ({
    country: countryCodes[i],
    data: r.status === 'fulfilled' ? r.value : [],
  }));
};

/* ── Check API connectivity ──────────────────────────────── */
PG.checkAPIStatus = async function() {
  updateAPIStatus('loading');
  try {
    const cached = await cacheGet('wb_countries_all');
    if (cached) { updateAPIStatus('online'); return true; }
    const res = await fetchPage(`${API_BASE}/country/WLD?format=json`, 1);
    updateAPIStatus(Array.isArray(res) ? 'online' : 'error');
    return Array.isArray(res);
  } catch {
    updateAPIStatus('error');
    return false;
  }
};

/* ── DOM helpers ─────────────────────────────────────────── */
function updateAPIStatus(status) {
  const dot   = document.getElementById('api-status-dot');
  const label = document.getElementById('api-status-label');
  if (!dot || !label) return;
  dot.className   = `nav-status-dot ${status}`;
  const map = { online: 'API Online', error: 'API Offline', loading: 'Connecting…' };
  label.textContent = map[status] || status;
}

function updateMetricEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val.toLocaleString();
}

/* ── Fallback countries (if API fails) ───────────────────── */
PG.FALLBACK_COUNTRIES = [
  { code: 'USA', name: 'United States', region: 'North America' },
  { code: 'GBR', name: 'United Kingdom', region: 'Europe' },
  { code: 'DEU', name: 'Germany', region: 'Europe' },
  { code: 'FRA', name: 'France', region: 'Europe' },
  { code: 'JPN', name: 'Japan', region: 'East Asia' },
  { code: 'CHN', name: 'China', region: 'East Asia' },
  { code: 'IND', name: 'India', region: 'South Asia' },
  { code: 'BRA', name: 'Brazil', region: 'Latin America' },
  { code: 'CAN', name: 'Canada', region: 'North America' },
  { code: 'AUS', name: 'Australia', region: 'Oceania' },
  { code: 'NGA', name: 'Nigeria', region: 'Sub-Saharan Africa' },
  { code: 'ZAF', name: 'South Africa', region: 'Sub-Saharan Africa' },
  { code: 'KEN', name: 'Kenya', region: 'Sub-Saharan Africa' },
  { code: 'GHA', name: 'Ghana', region: 'Sub-Saharan Africa' },
  { code: 'EGY', name: 'Egypt', region: 'Middle East & North Africa' },
  { code: 'MEX', name: 'Mexico', region: 'Latin America' },
  { code: 'KOR', name: 'South Korea', region: 'East Asia' },
  { code: 'IDN', name: 'Indonesia', region: 'East Asia & Pacific' },
  { code: 'TUR', name: 'Turkey', region: 'Europe & Central Asia' },
  { code: 'ARG', name: 'Argentina', region: 'Latin America' },
  { code: 'SAU', name: 'Saudi Arabia', region: 'Middle East & North Africa' },
  { code: 'POL', name: 'Poland', region: 'Europe' },
  { code: 'SWE', name: 'Sweden', region: 'Europe' },
  { code: 'NLD', name: 'Netherlands', region: 'Europe' },
  { code: 'NOR', name: 'Norway', region: 'Europe' },
  { code: 'CHE', name: 'Switzerland', region: 'Europe' },
  { code: 'SGP', name: 'Singapore', region: 'East Asia & Pacific' },
  { code: 'PAK', name: 'Pakistan', region: 'South Asia' },
  { code: 'BGD', name: 'Bangladesh', region: 'South Asia' },
  { code: 'VNM', name: 'Vietnam', region: 'East Asia & Pacific' },
];

/* ── Init ────────────────────────────────────────────────── */
PG.pipelineInit = async function() {
  await purgeExpired();
  await PG.checkAPIStatus();
};
