/* ============================================================
   PulseGrid — Charts Module
   Chart.js 4 wrappers for all visualisations
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ── Chart instances registry (for destroy/re-render) ─────── */
PG.charts = {};
PG._sparkCharts = [];  // Sparkline instances tracked for cleanup

/* ── Shared colour palette ───────────────────────────────── */
const C = {
  cyan:       '#00D4FF',
  cyanDim:    'rgba(0, 212, 255, 0.15)',
  cyanFill:   'rgba(0, 212, 255, 0.08)',
  violet:     '#A78BFA',
  violetDim:  'rgba(167, 139, 250, 0.15)',
  violetFill: 'rgba(167, 139, 250, 0.08)',
  green:      '#10B981',
  greenLight: '#6EE7B7',
  greenFill:  'rgba(16, 185, 129, 0.08)',
  amber:      '#F59E0B',
  red:        '#EF4444',
  redLight:   '#FCA5A5',
  redFill:    'rgba(239, 68, 68, 0.08)',
  white90:    'rgba(255,255,255,0.90)',
  white70:    'rgba(255,255,255,0.70)',
  white50:    'rgba(255,255,255,0.50)',
  white30:    'rgba(255,255,255,0.30)',
  white10:    'rgba(255,255,255,0.07)',
  grid:       'rgba(255,255,255,0.05)',
  bg400:      '#111120',
};

/* Country tag palette */
const COUNTRY_COLORS = [
  { line: C.cyan,    fill: C.cyanFill },
  { line: C.violet,  fill: C.violetFill },
  { line: C.greenLight, fill: C.greenFill },
  { line: C.amber,   fill: 'rgba(245,158,11,0.08)' },
  { line: '#F472B6', fill: 'rgba(244,114,182,0.08)' },
  { line: '#34D399', fill: 'rgba(52,211,153,0.08)' },
];

/* ── Shared default options ──────────────────────────────── */
function baseOptions(yLabel = '') {
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111120',
        borderColor: 'rgba(0,212,255,0.2)',
        borderWidth: 1,
        titleColor: C.white90,
        bodyColor: C.white70,
        padding: 12,
        callbacks: {
          title: items => items[0].label,
        },
      },
    },
    scales: {
      x: {
        grid:   { color: C.grid },
        ticks:  { color: C.white50, font: { family: "'JetBrains Mono', monospace", size: 11 }, maxTicksLimit: 10 },
        border: { color: C.white10 },
      },
      y: {
        grid:   { color: C.grid },
        ticks:  { color: C.white50, font: { family: "'JetBrains Mono', monospace", size: 11 }, maxTicksLimit: 7 },
        border: { color: C.white10 },
        title:  yLabel
          ? { display: true, text: yLabel, color: C.white50, font: { size: 11 } }
          : { display: false },
      },
    },
    animation: { duration: 600, easing: 'easeOutCubic' },
  };
}

/* ── Destroy helper ──────────────────────────────────────── */
function destroyChart(key) {
  if (PG.charts[key]) {
    PG.charts[key].destroy();
    delete PG.charts[key];
  }
}

/* ── Gradient helper ─────────────────────────────────────── */
function makeGradient(ctx, color, alpha1 = 0.5, alpha2 = 0.0) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  gradient.addColorStop(0, color.replace(')', `, ${alpha1})`).replace('rgb', 'rgba').replace('rgba(rgba', 'rgba'));
  gradient.addColorStop(1, color.replace(')', `, ${alpha2})`).replace('rgb', 'rgba').replace('rgba(rgba', 'rgba'));
  return gradient;
}

function hexGradient(canvasCtx, hexColor, alpha1 = 0.4, alpha2 = 0.0) {
  const g = canvasCtx.createLinearGradient(0, 0, 0, canvasCtx.canvas.offsetHeight || 300);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const gr = parseInt(hexColor.slice(3, 5), 16);
  const b  = parseInt(hexColor.slice(5, 7), 16);
  g.addColorStop(0,   `rgba(${r},${gr},${b},${alpha1})`);
  g.addColorStop(1,   `rgba(${r},${gr},${b},${alpha2})`);
  return g;
}

/* ============================================================
   MAIN CHART (line / bar / area)
   ============================================================ */
PG.renderMainChart = function(series, type = 'line', indicator = '') {
  const ctx = document.getElementById('main-chart');
  if (!ctx) return;
  destroyChart('main');
  PG.metrics.charts++;
  PG.updateMetricEl('pm-charts', PG.metrics.charts);

  const labels = series.map(d => d.year);
  const data   = series.map(d => d.value ?? null);

  const isArea = type === 'area';
  const isBar  = type === 'bar';
  const chartType = isBar ? 'bar' : 'line';

  const datasets = [{
    label: PG.INDICATORS[indicator] || 'Value',
    data,
    borderColor:     C.cyan,
    borderWidth:     isBar ? 0 : 2.5,
    pointRadius:     isArea ? 0 : 3,
    pointHoverRadius: 5,
    pointBackgroundColor: C.cyan,
    fill: isArea || !isBar,
    tension: 0.4,
    backgroundColor: ctx.getContext
      ? isBar
        ? C.cyanDim
        : (ctx2 => hexGradient(ctx2, '#00D4FF', 0.4, 0.02))(ctx.getContext('2d'))
      : C.cyanFill,
  }];

  const opts = baseOptions('');
  opts.plugins.legend.display = false;

  PG.charts.main = new Chart(ctx, { type: chartType, data: { labels, datasets }, options: opts });
};

/* ============================================================
   FORECAST CHART — historical + forecast + CI bands
   ============================================================ */
PG.renderForecastChart = function(result) {
  const ctx = document.getElementById('forecast-chart');
  if (!ctx || !result) return;
  destroyChart('forecast');
  PG.metrics.charts++;
  PG.updateMetricEl('pm-charts', PG.metrics.charts);

  const { historical, forecast, upperCI, lowerCI } = result;

  const histLabels = historical.map(d => d.year);
  const fcLabels   = forecast.map(d => d.year);
  const allLabels  = [...histLabels, ...fcLabels];

  const histVals   = historical.map(d => d.value ?? null);
  const fcPad      = new Array(historical.length).fill(null);
  const upperVals  = [...new Array(historical.length).fill(null), ...upperCI.map(d => d.value)];
  const lowerVals  = [...new Array(historical.length).fill(null), ...lowerCI.map(d => d.value)];
  const fcVals     = [...fcPad, ...forecast.map(d => d.value)];

  const datasets = [
    {
      label: 'Historical',
      data: histVals.concat(new Array(fcLabels.length).fill(null)),
      borderColor: C.cyan, borderWidth: 2.5,
      pointRadius: 2, pointHoverRadius: 5,
      fill: false, tension: 0.4,
      pointBackgroundColor: C.cyan,
    },
    {
      label: 'Forecast',
      data: fcVals,
      borderColor: C.violet, borderWidth: 2.5,
      borderDash: [6, 3],
      pointRadius: 4, pointHoverRadius: 6,
      fill: false, tension: 0.3,
      pointBackgroundColor: C.violet,
    },
    {
      label: 'Upper CI',
      data: upperVals,
      borderColor: 'transparent', borderWidth: 0,
      pointRadius: 0,
      fill: '+1', // fill toward lower
      backgroundColor: C.violetFill,
      tension: 0.3,
    },
    {
      label: 'Lower CI',
      data: lowerVals,
      borderColor: 'transparent', borderWidth: 0,
      pointRadius: 0,
      fill: false,
      backgroundColor: C.violetFill,
      tension: 0.3,
    },
  ];

  const opts = baseOptions('');
  opts.plugins.tooltip.callbacks.label = item => {
    if (item.dataset.label.includes('CI')) return null;
    return ` ${item.dataset.label}: ${item.formattedValue}`;
  };

  // Mark forecast boundary with vertical annotation-like plug
  opts.plugins.vertLine = {
    xValue: String(historical[historical.length - 1].year),
  };

  PG.charts.forecast = new Chart(ctx, { type: 'line', data: { labels: allLabels, datasets }, options: opts });
};

/* ============================================================
   ANOMALY CHART — line + scatter markers
   ============================================================ */
PG.renderAnomalyChart = function(series, { anomalies, normal }) {
  const ctx = document.getElementById('anomaly-chart');
  if (!ctx) return;
  destroyChart('anomaly');
  PG.metrics.charts++;
  PG.updateMetricEl('pm-charts', PG.metrics.charts);

  const labels    = series.map(d => d.value !== null ? d.year : null).filter(Boolean);
  const allVals   = series.map(d => d.value ?? null);

  // Flag which years are anomalies
  const anomalyYears = new Set(anomalies.map(a => a.year));
  const anomalyPts   = series.map(d => anomalyYears.has(d.year) ? d.value : null);
  const normalPts    = series.map(d => !anomalyYears.has(d.year) ? d.value : null);

  const datasets = [
    {
      label: 'Time Series',
      data: allVals,
      borderColor: C.white30, borderWidth: 1.5,
      pointRadius: 0,
      fill: false, tension: 0.4,
      type: 'line',
    },
    {
      label: 'Normal',
      data: normalPts,
      borderColor: C.cyan,
      backgroundColor: C.cyan,
      borderWidth: 0,
      pointRadius: 3, pointHoverRadius: 5,
      type: 'scatter',
      showLine: false,
    },
    {
      label: 'Anomaly',
      data: anomalyPts,
      borderColor: C.red,
      backgroundColor: C.red,
      borderWidth: 0,
      pointRadius: 6, pointHoverRadius: 8,
      pointStyle: 'triangle',
      type: 'scatter',
      showLine: false,
    },
  ];

  const opts = baseOptions('');
  opts.plugins.tooltip.callbacks.label = item => {
    if (item.dataset.label === 'Anomaly') return ` ⚠ Anomaly: ${item.formattedValue}`;
    return ` ${item.dataset.label}: ${item.formattedValue}`;
  };

  const allLabels = series.map(d => d.year);
  PG.charts.anomaly = new Chart(ctx, { type: 'line', data: { labels: allLabels, datasets }, options: opts });
};

/* ============================================================
   COMPARE CHART — multi-country line chart
   ============================================================ */
PG.renderCompareChart = function(countryDatasets, normalise = false) {
  const ctx = document.getElementById('compare-chart');
  if (!ctx) return;
  destroyChart('compare');
  PG.metrics.charts++;
  PG.updateMetricEl('pm-charts', PG.metrics.charts);

  // Find union of all years
  const yearsSet = new Set();
  countryDatasets.forEach(cd => cd.data.forEach(d => yearsSet.add(d.year)));
  const labels = Array.from(yearsSet).sort((a, b) => a - b);

  const datasets = countryDatasets.map((cd, i) => {
    const col    = COUNTRY_COLORS[i % COUNTRY_COLORS.length];
    const byYear = {};
    cd.data.forEach(d => { byYear[d.year] = d.value; });
    let values = labels.map(y => byYear[y] ?? null);

    if (normalise) {
      // Index to 100 at first non-null
      const first = values.find(v => v !== null);
      if (first && first !== 0) values = values.map(v => v !== null ? (v / first) * 100 : null);
    }

    return {
      label: cd.country,
      data: values,
      borderColor: col.line, borderWidth: 2.5,
      backgroundColor: col.fill,
      pointRadius: 3, pointHoverRadius: 5,
      pointBackgroundColor: col.line,
      fill: false, tension: 0.4,
    };
  });

  const opts = baseOptions(normalise ? 'Index (Base=100)' : '');
  opts.plugins.legend = {
    display: true,
    position: 'top',
    labels: { color: C.white70, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } },
  };

  PG.charts.compare = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: opts });
};

/* ============================================================
   HEATMAP — CSS grid cells coloured by correlation value
   ============================================================ */
PG.renderHeatmap = function({ labels, matrix }) {
  const wrap = document.getElementById('heatmap-grid');
  if (!wrap) return;
  const n = labels.length;
  if (n === 0) return;

  wrap.innerHTML = '';
  wrap.style.gridTemplateColumns = `80px repeat(${n}, minmax(64px, 1fr))`;

  function corrColor(r) {
    if (r === null) return '#111120';
    const a = Math.abs(r);
    if (r > 0) {
      // Positive: dark → cyan
      const intensity = Math.round(a * 255);
      return `rgba(0, ${Math.round(intensity * 0.8)}, ${intensity}, ${0.15 + a * 0.6})`;
    } else {
      // Negative: dark → red
      const intensity = Math.round(a * 255);
      return `rgba(${intensity}, ${Math.round(intensity * 0.2)}, ${Math.round(intensity * 0.2)}, ${0.15 + a * 0.6})`;
    }
  }

  function textColor(r) {
    if (r === null) return C.white30;
    return Math.abs(r) > 0.5 ? '#ffffff' : C.white70;
  }

  // Header row
  const blankCell = document.createElement('div');
  blankCell.className = 'heatmap-cell';
  blankCell.style.background = 'transparent';
  wrap.appendChild(blankCell);

  labels.forEach(lbl => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell heatmap-label-col';
    cell.textContent = lbl.length > 10 ? lbl.slice(0, 10) + '…' : lbl;
    cell.title = lbl;
    cell.style.background = 'transparent';
    cell.style.fontSize   = '0.62rem';
    cell.style.color      = C.white50;
    wrap.appendChild(cell);
  });

  // Data rows
  matrix.forEach((row, i) => {
    // Row label
    const rowLabel = document.createElement('div');
    rowLabel.className = 'heatmap-cell';
    rowLabel.textContent = labels[i].length > 10 ? labels[i].slice(0, 10) + '…' : labels[i];
    rowLabel.title = labels[i];
    rowLabel.style.background = 'transparent';
    rowLabel.style.fontSize   = '0.62rem';
    rowLabel.style.color      = C.white50;
    rowLabel.style.textAlign  = 'right';
    rowLabel.style.paddingRight = '8px';
    wrap.appendChild(rowLabel);

    row.forEach((r, j) => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.background = corrColor(r);
      cell.style.color = textColor(r);
      cell.title = r !== null ? `${labels[i]} × ${labels[j]}: r = ${r.toFixed(3)}` : 'No data';

      if (r !== null) {
        const val = document.createElement('span');
        val.className = 'heatmap-val';
        val.textContent = r === 1 ? '1.00' : r.toFixed(2);
        cell.appendChild(val);
      }
      wrap.appendChild(cell);
    });
  });
};

/* ============================================================
   SPARKLINE — tiny inline chart
   ============================================================ */
PG.renderSparklines = function(seriesArray, indicator) {
  const container = document.getElementById('spark-cards');
  if (!container) return;

  // Destroy previous sparkline Chart instances to prevent memory leak
  if (PG._sparkCharts && PG._sparkCharts.length) {
    PG._sparkCharts.forEach(c => { try { c.destroy(); } catch(_){} });
  }
  PG._sparkCharts = [];
  container.innerHTML = '';

  // Show last 5–8 indicators from the series array
  seriesArray.forEach((dataset, idx) => {
    if (!dataset || !dataset.data || dataset.data.length < 3) return;

    const vals    = dataset.data.filter(d => d.value !== null);
    const latest  = vals[vals.length - 1];
    const prev    = vals[vals.length - 2];
    const change  = prev && prev.value !== 0
      ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100
      : null;
    const isUp    = change !== null && change >= 0;

    const card = document.createElement('div');
    card.className = 'spark-card reveal';
    card.innerHTML = `
      <div class="spark-card-label">${dataset.label}</div>
      <div class="spark-card-val ${isUp ? 'up' : 'down'}">${PG.format(latest.value, dataset.indicator)}</div>
      <div class="spark-canvas-wrap"><canvas id="spark-${idx}" height="48"></canvas></div>
      <div class="spark-card-change">
        ${latest.year} · <span class="${isUp ? 'up' : 'down'}">${change !== null ? (isUp ? '+' : '') + change.toFixed(1) + '%' : 'N/A'}</span>
      </div>
    `;
    container.appendChild(card);
    setTimeout(() => card.classList.add('visible'), 50 * idx);

    // Draw sparkline
    const sparkCtx = document.getElementById(`spark-${idx}`);
    if (!sparkCtx) return;

    const sparkVals = vals.slice(-12).map(d => d.value);
    const sparkLabels = vals.slice(-12).map(d => d.year);
    const col = isUp ? '#6EE7B7' : '#FCA5A5';

    const sparkChart = new Chart(sparkCtx, {
      type: 'line',
      data: {
        labels: sparkLabels,
        datasets: [{
          data: sparkVals,
          borderColor: col,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          backgroundColor: col.replace(')', ', 0.1)').replace('rgb', 'rgba'),
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 300 },
      },
    });
    PG._sparkCharts.push(sparkChart);
  });
};

/* ============================================================
   INSIGHT LIST renderer
   ============================================================ */
PG.renderInsights = function(insights) {
  const list = document.getElementById('insight-list');
  if (!list) return;
  list.innerHTML = insights.length
    ? insights.map(ins => `
      <li class="insight-item">
        <span class="insight-dot" style="background:${ins.color}"></span>
        <span>${ins.text}</span>
      </li>`).join('')
    : '<li class="insight-item"><span class="insight-dot" style="background:#4B5563"></span><span>Select 3+ indicators and run correlation to see insights.</span></li>';
};
