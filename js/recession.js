/* ============================================================
   PulseGrid — Recession Predictor Module
   Composite Leading Indicator (CLI) engine that combines
   multiple economic signals to estimate recession probability.
   Uses GDP growth, unemployment delta, inflation acceleration,
   yield curve proxy, and trade balance deterioration.
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ── Leading indicator definitions ───────────────────────── */
const RECESSION_INDICATORS = [
  {
    code: 'NY.GDP.MKTP.KD.ZG',
    name: 'GDP Growth',
    weight: 0.30,
    threshold: 0, // below 0 = contractionary signal
    invert: false,
    signal: v => v < 0 ? 1 : v < 1 ? 0.5 : 0,
  },
  {
    code: 'SL.UEM.TOTL.ZS',
    name: 'Unemployment',
    weight: 0.20,
    invert: true, // rising unemployment = bad
    signal: (v, prev) => {
      if (prev === null) return 0;
      const delta = v - prev;
      return delta > 2 ? 1 : delta > 0.5 ? 0.6 : delta > 0 ? 0.3 : 0;
    },
  },
  {
    code: 'FP.CPI.TOTL.ZG',
    name: 'Inflation',
    weight: 0.15,
    invert: false,
    signal: v => v > 15 ? 1 : v > 10 ? 0.7 : v > 5 ? 0.3 : v < 0 ? 0.5 : 0,
  },
  {
    code: 'NE.EXP.GNFS.ZS',
    name: 'Exports (% GDP)',
    weight: 0.15,
    invert: false,
    signal: (v, prev) => {
      if (prev === null) return 0;
      const delta = v - prev;
      return delta < -5 ? 0.8 : delta < -2 ? 0.4 : 0;
    },
  },
  {
    code: 'BX.KLT.DINV.WD.GD.ZS',
    name: 'FDI Inflows',
    weight: 0.10,
    invert: false,
    signal: (v, prev) => {
      if (prev === null) return 0;
      const delta = v - prev;
      return delta < -2 ? 0.8 : delta < -0.5 ? 0.4 : 0;
    },
  },
  {
    code: 'GC.DOD.TOTL.GD.ZS',
    name: 'Govt Debt (% GDP)',
    weight: 0.10,
    invert: true,
    signal: v => v > 100 ? 0.8 : v > 80 ? 0.5 : v > 60 ? 0.2 : 0,
  },
];

/* ============================================================
   RECESSION PROBABILITY CALCULATOR
   ============================================================ */

/**
 * Calculate recession probability for a country
 * @param {string} countryCode
 * @returns {Promise<Object>} recession analysis
 */
PG.predictRecession = async function(countryCode) {
  const CURRENT_YEAR = new Date().getFullYear();
  const FROM_YEAR = CURRENT_YEAR - 25;

  PG.log(`Recession predictor: Fetching ${RECESSION_INDICATORS.length} indicators for ${countryCode}…`, 'info');

  // Fetch all indicators
  const fetchPromises = RECESSION_INDICATORS.map(ind =>
    PG.fetchWorldBank(countryCode, ind.code, FROM_YEAR, CURRENT_YEAR)
      .then(data => ({ code: ind.code, data, error: null }))
      .catch(err => ({ code: ind.code, data: [], error: err.message }))
  );

  const results = await Promise.all(fetchPromises);

  // Build year-by-year composite
  const yearData = {};

  results.forEach((result, idx) => {
    const ind = RECESSION_INDICATORS[idx];
    result.data.forEach(d => {
      if (d.value === null || !isFinite(d.value)) return;
      if (!yearData[d.year]) yearData[d.year] = {};
      yearData[d.year][ind.code] = d.value;
    });
  });

  const years = Object.keys(yearData).map(Number).sort((a, b) => a - b);
  if (years.length < 3) {
    return { error: 'Insufficient data', probability: null, signals: [], timeline: [] };
  }

  // Calculate composite signal per year
  const timeline = [];
  let prevYearData = null;

  years.forEach(year => {
    const yd = yearData[year];
    let totalWeight = 0;
    let compositeSignal = 0;
    const signals = [];

    RECESSION_INDICATORS.forEach(ind => {
      const val = yd[ind.code];
      if (val === undefined) return;

      const prevVal = prevYearData ? (prevYearData[ind.code] || null) : null;
      const sig = ind.signal(val, prevVal);

      compositeSignal += sig * ind.weight;
      totalWeight += ind.weight;

      signals.push({
        name: ind.name,
        value: val,
        signal: sig,
        weight: ind.weight,
        contribution: sig * ind.weight,
        status: sig >= 0.7 ? 'danger' : sig >= 0.3 ? 'warning' : 'safe',
      });
    });

    const probability = totalWeight > 0 ? Math.min(1, compositeSignal / totalWeight) : 0;

    timeline.push({
      year,
      probability: Math.round(probability * 100),
      signals,
      riskLevel: probability >= 0.6 ? 'high' : probability >= 0.35 ? 'elevated' : probability >= 0.15 ? 'moderate' : 'low',
    });

    prevYearData = yd;
  });

  // Get latest assessment
  const latest = timeline[timeline.length - 1];
  const trend = timeline.length >= 3
    ? timeline[timeline.length - 1].probability - timeline[timeline.length - 3].probability
    : 0;

  // Generate alert
  let alert = null;
  if (latest.probability >= 60) {
    alert = { level: 'critical', message: `⚠️ CRITICAL: ${latest.probability}% recession probability detected. Multiple leading indicators are signalling contraction.` };
  } else if (latest.probability >= 35) {
    alert = { level: 'warning', message: `⚡ ELEVATED RISK: ${latest.probability}% recession probability. Some leading indicators are deteriorating.` };
  } else if (trend > 15) {
    alert = { level: 'watch', message: `📡 WATCH: Recession risk trending upward (+${trend}pp in recent years). Monitor closely.` };
  }

  // 12-month projection (simple linear extrapolation of recent trend)
  const recentTrend = timeline.length >= 5
    ? (timeline[timeline.length - 1].probability - timeline[timeline.length - 5].probability) / 5
    : 0;
  const projected12m = Math.max(0, Math.min(100, Math.round(latest.probability + recentTrend)));

  return {
    country: countryCode,
    latestYear: latest.year,
    probability: latest.probability,
    riskLevel: latest.riskLevel,
    signals: latest.signals,
    alert,
    timeline,
    trend,
    projected12m,
    indicatorsUsed: results.filter(r => r.data.length > 0).length,
    totalIndicators: RECESSION_INDICATORS.length,
  };
};

/* ── Render recession dashboard ──────────────────────────── */
PG.renderRecessionDashboard = function(result) {
  if (!result || result.error) {
    const el = document.getElementById('recession-output');
    if (el) el.innerHTML = `<div class="narrative-section"><p>${result?.error || 'Analysis failed'}</p></div>`;
    return;
  }

  // Gauge
  const gaugeEl = document.getElementById('recession-gauge');
  if (gaugeEl) {
    const color = result.probability >= 60 ? 'var(--red)' : result.probability >= 35 ? 'var(--amber)' : 'var(--green)';
    const rotation = (result.probability / 100) * 180;
    gaugeEl.innerHTML = `
      <div class="gauge-wrap">
        <div class="gauge-bg"></div>
        <div class="gauge-fill" style="transform: rotate(${rotation}deg); background: ${color}"></div>
        <div class="gauge-center">
          <span class="gauge-value" style="color:${color}">${result.probability}%</span>
          <span class="gauge-label">Recession Risk</span>
        </div>
      </div>
      <div class="gauge-meta">
        <span class="gauge-risk-badge ${result.riskLevel}">${result.riskLevel.toUpperCase()}</span>
        <span class="gauge-year">As of ${result.latestYear}</span>
      </div>
    `;
  }

  // Alert
  const alertEl = document.getElementById('recession-alert');
  if (alertEl && result.alert) {
    alertEl.innerHTML = `<div class="recession-alert-box ${result.alert.level}">${result.alert.message}</div>`;
    alertEl.classList.remove('hidden');
  } else if (alertEl) {
    alertEl.innerHTML = `<div class="recession-alert-box safe">✅ No immediate recession signals detected. Economy appears stable.</div>`;
    alertEl.classList.remove('hidden');
  }

  // Signal breakdown
  const signalsEl = document.getElementById('recession-signals');
  if (signalsEl) {
    signalsEl.innerHTML = result.signals.map(s => `
      <div class="recession-signal ${s.status}">
        <div class="recession-signal-header">
          <span class="recession-signal-name">${s.name}</span>
          <span class="recession-signal-badge ${s.status}">${s.status === 'danger' ? '🔴' : s.status === 'warning' ? '🟡' : '🟢'}</span>
        </div>
        <div class="recession-signal-bar">
          <div class="recession-signal-fill" style="width:${Math.round(s.signal * 100)}%; background:${s.status === 'danger' ? 'var(--red)' : s.status === 'warning' ? 'var(--amber)' : 'var(--green)'}"></div>
        </div>
        <div class="recession-signal-meta">
          <span>Value: ${s.value.toFixed(2)}</span>
          <span>Signal: ${(s.signal * 100).toFixed(0)}%</span>
          <span>Weight: ${(s.weight * 100).toFixed(0)}%</span>
        </div>
      </div>
    `).join('');
  }

  // Timeline chart
  renderRecessionTimeline(result.timeline);

  // Projection
  const projEl = document.getElementById('recession-projection');
  if (projEl) {
    const arrow = result.trend > 5 ? '↑' : result.trend < -5 ? '↓' : '→';
    projEl.innerHTML = `
      <div class="recession-proj-card">
        <span class="recession-proj-label">12-Month Projection</span>
        <span class="recession-proj-value">${result.projected12m}% ${arrow}</span>
        <span class="recession-proj-sub">Based on ${result.indicatorsUsed}/${result.totalIndicators} indicators</span>
      </div>
    `;
  }
};

/* ── Render timeline chart ───────────────────────────────── */
function renderRecessionTimeline(timeline) {
  const ctx = document.getElementById('recession-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (PG.charts.recession) {
    PG.charts.recession.destroy();
    delete PG.charts.recession;
  }

  const labels = timeline.map(t => t.year);
  const data = timeline.map(t => t.probability);

  const colors = data.map(v => v >= 60 ? 'rgba(239,68,68,0.8)' : v >= 35 ? 'rgba(245,158,11,0.8)' : 'rgba(16,185,129,0.8)');

  PG.charts.recession = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Recession Probability (%)',
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111120',
          borderColor: 'rgba(0,212,255,0.2)',
          borderWidth: 1,
          callbacks: {
            label: item => ` Risk: ${item.raw}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.5)', font: { family: "'JetBrains Mono', monospace", size: 11 } },
        },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(255,255,255,0.5)',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: v => v + '%',
          },
          title: { display: true, text: 'Recession Probability', color: 'rgba(255,255,255,0.5)' },
        },
      },
      animation: { duration: 600 },
    },
  });

  PG.metrics.charts++;
  PG.updateMetricEl('pm-charts', PG.metrics.charts);
}

PG.log && PG.log('Recession Predictor loaded', 'success');
