/* ============================================================
   PulseGrid — Engine Module
   Holt-Winters · Pearson · Z-score · IQR · Stats
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ============================================================
   DESCRIPTIVE STATISTICS
   ============================================================ */
PG.calcStats = function(series) {
  if (!Array.isArray(series) || series.length === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0, n: 0, variance: 0 };
  const vals  = series.map(d => d.value).filter(v => v !== null && isFinite(v));
  const n     = vals.length;
  if (n === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0, n: 0, variance: 0 };

  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n > 1 ? n - 1 : 1);
  const std  = Math.sqrt(variance);

  const sorted = [...vals].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  return { mean, std, min: sorted[0], max: sorted[n - 1], median, n, variance };
};

PG.calcCAGR = function(series) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const vals  = series.filter(d => d.value !== null && d.value > 0);
  if (vals.length < 2) return null;
  const first = vals[0];
  const last  = vals[vals.length - 1];
  const years = last.year - first.year;
  if (years === 0) return null;
  return (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
};

PG.calcVolatility = function(series) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const vals = series.map(d => d.value).filter(v => v !== null && isFinite(v));
  if (vals.length < 2) return null;
  const growth = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i - 1] !== 0) growth.push((vals[i] - vals[i - 1]) / Math.abs(vals[i - 1]) * 100);
  }
  const s = PG.calcStats(growth.map((v, i) => ({ year: i, value: v })));
  return s.std;
};

PG.calcChange = function(series) {
  if (!Array.isArray(series) || series.length === 0) return { abs: null, pct: null };
  const vals = series.filter(d => d.value !== null && isFinite(d.value));
  if (vals.length < 2) return { abs: null, pct: null };
  const first = vals[0].value;
  const last  = vals[vals.length - 1].value;
  return {
    abs: last - first,
    pct: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null,
  };
};

/* ============================================================
   HOLT-WINTERS DOUBLE EXPONENTIAL SMOOTHING
   (Additive trend, no seasonality — appropriate for annual data)
   ============================================================ */
PG.holtwinters = function(series, { alpha = 0.3, beta = 0.1, horizon = 5, ci = 95 } = {}) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const vals  = series.filter(d => d.value !== null && isFinite(d.value));
  const n     = vals.length;
  if (n < 3) return null;

  const data = vals.map(d => d.value);

  /* Initialise */
  let level = data[0];
  let trend = data[1] - data[0];

  const smoothed = [];
  const errors   = [];

  for (let i = 0; i < n; i++) {
    const obs     = data[i];
    const prevL   = level;
    const prevT   = trend;
    level = alpha * obs + (1 - alpha) * (prevL + prevT);
    trend = beta  * (level - prevL) + (1 - beta) * prevT;
    const fitted  = prevL + prevT;
    smoothed.push(fitted);
    errors.push(obs - fitted);
  }

  /* Forecast */
  const forecast = [];
  const lastYear = vals[n - 1].year;
  for (let h = 1; h <= horizon; h++) {
    forecast.push({ year: lastYear + h, value: level + h * trend });
  }

  /* Confidence intervals */
  const s = PG.calcStats(errors.map((v, i) => ({ year: i, value: v })));
  const z = ci === 99 ? 2.576 : ci === 90 ? 1.645 : 1.960; // 95% default
  const se = s.std * Math.sqrt(1 + 0.1 * horizon);

  const upper = forecast.map(f => ({ year: f.year, value: f.value + z * se }));
  const lower = forecast.map(f => ({ year: f.year, value: f.value - z * se }));

  /* Accuracy metrics on fitted */
  const mape = errors
    .filter((_, i) => data[i] !== 0)
    .map((e, i) => Math.abs(e / data[i]) * 100)
    .reduce((a, b) => a + b, 0) / n;

  const rmse = Math.sqrt(
    errors.map(e => e * e).reduce((a, b) => a + b, 0) / n
  );

  PG.metrics.models++;
  updateMetricEl('pm-models', PG.metrics.models);

  return {
    historical: vals,
    smoothed: vals.map((d, i) => ({ year: d.year, value: smoothed[i] })),
    forecast,
    upperCI: upper,
    lowerCI: lower,
    params: { alpha, beta, horizon, ci },
    accuracy: { mape: mape.toFixed(2), rmse: rmse.toFixed(4), n },
  };
};

/* ============================================================
   PEARSON CORRELATION MATRIX
   ============================================================ */
PG.pearson = function(a, b) {
  // Align by year
  const byYear = {};
  a.forEach(d => { if (d.value !== null) byYear[d.year] = { a: d.value }; });
  b.forEach(d => {
    if (d.value !== null && byYear[d.year]) byYear[d.year].b = d.value;
  });

  const pairs = Object.values(byYear).filter(p => p.b !== undefined);
  if (pairs.length < 3) return null;

  const xs = pairs.map(p => p.a);
  const ys = pairs.map(p => p.b);
  const n  = pairs.length;

  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx;
    const ey = ys[i] - my;
    num += ex * ey;
    dx  += ex * ex;
    dy  += ey * ey;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 1000;
};

PG.pearsonMatrix = function(datasets) {
  const k      = datasets.length;
  const labels = datasets.map(d => d.label);
  const matrix = Array.from({ length: k }, () => new Array(k).fill(null));

  for (let i = 0; i < k; i++) {
    matrix[i][i] = 1.0;
    for (let j = i + 1; j < k; j++) {
      const r = PG.pearson(datasets[i].data, datasets[j].data);
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  // Generate insights
  const insights = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const r = matrix[i][j];
      if (r === null) continue;
      const abs = Math.abs(r);
      let strength, color;
      if (abs >= 0.85)      { strength = 'very strong'; color = '#00D4FF'; }
      else if (abs >= 0.65) { strength = 'strong';      color = '#67E8F9'; }
      else if (abs >= 0.45) { strength = 'moderate';    color = '#A78BFA'; }
      else                   { strength = 'weak';        color = '#6B7280'; }
      if (abs >= 0.45) {
        insights.push({
          text: `${labels[i]} and ${labels[j]} show a ${strength} ${r > 0 ? 'positive' : 'negative'} correlation (r = ${r.toFixed(2)}).`,
          color, r,
        });
      }
    }
  }
  insights.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return { labels, matrix, insights: insights.slice(0, 5) };
};

/* ============================================================
   ANOMALY DETECTION — Z-Score & IQR
   ============================================================ */
PG.detectAnomalies = function(series, { method = 'both', threshold = 2.5 } = {}) {
  const vals    = series.filter(d => d.value !== null && isFinite(d.value));
  const n       = vals.length;
  if (n < 4) return { anomalies: [], normal: vals };

  const numbers = vals.map(d => d.value);
  const { mean, std } = PG.calcStats(vals);

  // IQR
  const sorted  = [...numbers].sort((a, b) => a - b);
  const q1      = sorted[Math.floor(n * 0.25)];
  const q3      = sorted[Math.floor(n * 0.75)];
  const iqr     = q3 - q1;
  const iqrLow  = q1 - 1.5 * iqr;
  const iqrHigh = q3 + 1.5 * iqr;

  const anomalies = [];
  const normal    = [];

  vals.forEach(d => {
    const z        = std > 0 ? Math.abs((d.value - mean) / std) : 0;
    const isZ      = z >= threshold;
    const isIQR    = d.value < iqrLow || d.value > iqrHigh;

    let flag = false;
    if (method === 'zscore') flag = isZ;
    else if (method === 'iqr') flag = isIQR;
    else flag = isZ || isIQR; // both

    if (flag) {
      anomalies.push({ ...d, z: z.toFixed(2), isZ, isIQR });
    } else {
      normal.push(d);
    }
  });

  return { anomalies, normal, stats: { mean, std, q1, q3, iqr, iqrLow, iqrHigh } };
};

/* ============================================================
   FORMATTING HELPERS
   ============================================================ */
PG.format = function(value, indicator) {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';

  const large = ['NY.GDP.MKTP.CD', 'SP.POP.TOTL', 'EG.USE.ELEC.KH.PC'];
  const pct   = [
    'NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'NE.EXP.GNFS.ZS',
    'NE.IMP.GNFS.ZS', 'BX.KLT.DINV.WD.GD.ZS', 'GC.DOD.TOTL.GD.ZS', 'SE.ADT.LITR.ZS',
    'SH.XPD.CHEX.GD.ZS', 'IT.NET.USER.ZS',
  ];

  if (large.includes(indicator)) {
    if (Math.abs(value) >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (Math.abs(value) >= 1e9)  return (value / 1e9).toFixed(2) + 'B';
    if (Math.abs(value) >= 1e6)  return (value / 1e6).toFixed(2) + 'M';
    if (Math.abs(value) >= 1e3)  return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  }
  if (pct.includes(indicator)) return value.toFixed(2) + '%';
  return value.toFixed(2);
};

PG.trendIcon = function(val) {
  if (!val || isNaN(val)) return '—';
  return val > 0 ? '↑' : '↓';
};

PG.trendClass = function(val) {
  if (!val || isNaN(val)) return '';
  return val > 0 ? 'positive' : 'negative';
};

/* DOM helper shared with pipeline.js */
function updateMetricEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
}

PG.updateMetricEl = updateMetricEl;
