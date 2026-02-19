/* ============================================================
   PulseGrid — App Module
   UI controller · preloader · nav · all interactions
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  initNav();
  initReveal();
  initBackToTop();
  initTooltip();
  initChartTypeBtns();
  initMethodToggle();
  initSliders();
  initNormaliseToggle();
  initOfflineBanner();

  await runPreloader();

  initDashboard();
  initForecast();
  initCorrelation();
  initAnomaly();
  initCompare();
  initPipelineSection();
  updateSessionStats();
});

/* ============================================================
   PRELOADER
   ============================================================ */
async function runPreloader() {
  const loader  = document.getElementById('preloader');
  const steps   = ['pipe-ingest', 'pipe-transform', 'pipe-model', 'pipe-output'];
  const labels  = ['Connecting to World Bank API…', 'Fetching country index…', 'Initialising ML engine…', 'Rendering interface…'];
  const statusEl = document.getElementById('preloader-status');

  for (let i = 0; i < steps.length; i++) {
    const stepEl = document.getElementById(steps[i]);
    if (statusEl) statusEl.textContent = labels[i];
    if (stepEl) stepEl.classList.add('active');
    await sleep(i === 1 ? 600 : 350);
    if (stepEl) { stepEl.classList.remove('active'); stepEl.classList.add('done'); }
  }

  // Init pipeline + countries in background (with 15s timeout)
  try {
    await Promise.race([
      (async () => { await PG.pipelineInit(); await populateCountrySelects(); })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
  } catch (e) {
    PG.log(`API init failed (${e.message}); using fallback data`, 'warn');
    populateCountrySelectsFallback();
  }

  if (statusEl) statusEl.textContent = 'Ready!';
  await sleep(300);

  if (loader) {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 700);
  }
}

/* ── Populate country dropdowns ──────────────────────────── */
async function populateCountrySelects() {
  const countries = await PG.fetchCountries();
  const selects   = document.querySelectorAll('.country-select-target');
  selects.forEach(sel => {
    const defaultOpt = sel.querySelector('[data-default]');
    sel.innerHTML = '';
    if (defaultOpt) sel.appendChild(defaultOpt.cloneNode(true));
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.code; opt.textContent = c.name;
      if (c.code === 'GBR') opt.selected = !defaultOpt;
      sel.appendChild(opt);
    });
  });
  // Update hero stats
  const hsEl = document.getElementById('hs-countries');
  if (hsEl) hsEl.textContent = countries.length;
}

function populateCountrySelectsFallback() {
  const selects = document.querySelectorAll('.country-select-target');
  selects.forEach(sel => {
    sel.innerHTML = '';
    PG.FALLBACK_COUNTRIES.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = c.code; opt.textContent = c.name;
      if (i === 1) opt.selected = true; // GBR default
      sel.appendChild(opt);
    });
  });
}

/* ============================================================
   NAV
   ============================================================ */
function initNav() {
  const nav       = document.querySelector('.nav');
  const burger    = document.getElementById('nav-burger');
  const overlay   = document.getElementById('nav-overlay');
  const closeBtn  = document.getElementById('nav-overlay-close');
  const overlayLinks = document.querySelectorAll('.nav-overlay-link');

  // Scroll class
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('scrolled', window.scrollY > 60);
    highlightActiveNavLink();
  }, { passive: true });

  // Burger open
  burger?.addEventListener('click', () => {
    overlay?.classList.add('open');
    burger.classList.add('open');
    document.body.classList.add('menu-open');
  });

  // Close
  function closeMenu() {
    overlay?.classList.remove('open');
    burger?.classList.remove('open');
    document.body.classList.remove('menu-open');
  }

  closeBtn?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeMenu(); });
  overlayLinks.forEach(link => link.addEventListener('click', closeMenu));

  // Keyboard close
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}

function highlightActiveNavLink() {
  const sections  = document.querySelectorAll('section[id], div[id].section-wrap');
  const navLinks  = document.querySelectorAll('.nav-link, .nav-overlay-link');
  const scrollY   = window.scrollY + 120;

  let current = '';
  sections.forEach(sec => {
    if (sec.offsetTop <= scrollY) current = sec.id;
  });

  navLinks.forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === `#${current}`);
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
let dashState = { type: 'line', series: null, indicator: '' };

function initDashboard() {
  const loadBtn = document.getElementById('load-data-btn');
  if (loadBtn) loadBtn.addEventListener('click', loadDashboardData);

  // Set "To" year to current year (From keeps its HTML-selected default)
  const toEl = document.getElementById('year-to');
  if (toEl) toEl.value = CURRENT_YEAR;

  // Auto-load dashboard with default selections on startup
  loadDashboardData();
}

async function loadDashboardData() {
  const countryEl    = document.getElementById('country-select');
  const indicatorEl  = document.getElementById('indicator-select');
  const fromEl       = document.getElementById('year-from');
  const toEl         = document.getElementById('year-to');
  const btn          = document.getElementById('load-data-btn');

  if (!countryEl || !indicatorEl) return;

  const country   = countryEl.value;
  const indicator = indicatorEl.value;
  const from      = parseInt(fromEl?.value || 2000);
  const to        = parseInt(toEl?.value   || CURRENT_YEAR);

  if (!country || !indicator) return;

  setButtonLoading(btn, true);
  hideEmpty('main');

  try {
    const series = await PG.fetchWorldBank(country, indicator, from, to);
    dashState.series    = series;
    dashState.indicator = indicator;

    if (series.length === 0) {
      showEmpty('main', 'No data available for this selection.');
      return;
    }

    PG.renderMainChart(series, dashState.type, indicator);
    updateMetricCards(series, indicator);
    updateChartTitles(country, indicator, countryEl, indicatorEl);
    loadSparklines(country, from, to);

    const emptyEl = document.getElementById('chart-empty');
    if (emptyEl) emptyEl.classList.add('hidden');

  } catch (err) {
    showEmpty('main', 'Failed to load data. Please check your connection.');
    PG.log(`Dashboard error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function updateMetricCards(series, indicator) {
  const vals  = series.filter(d => d.value !== null);
  if (!vals.length) return;

  const latest = vals[vals.length - 1];
  const cagr   = PG.calcCAGR(series);
  const vol    = PG.calcVolatility(series);
  const change = PG.calcChange(series);

  setEl('mc-latest-val',  PG.format(latest.value, indicator));
  setEl('mc-latest-year', latest.year);
  setEl('mc-change-val',  change.abs !== null ? PG.format(change.abs, indicator) : 'N/A');
  setEl('mc-change-pct',  change.pct !== null ? `${change.pct >= 0 ? '+' : ''}${change.pct.toFixed(1)}%` : '');
  setEl('mc-trend-val',   cagr !== null ? `${cagr >= 0 ? '+' : ''}${cagr.toFixed(2)}% CAGR` : 'N/A');
  setEl('mc-vol-val',     vol  !== null ? `${vol.toFixed(2)}%` : 'N/A');

  // Apply colour class to change
  const changeEl = document.getElementById('mc-change-val');
  if (changeEl && change.pct !== null) {
    changeEl.className = `mc-val ${change.pct >= 0 ? 'positive' : 'negative'}`;
  }

  // Animate cards
  document.querySelectorAll('.metric-card').forEach((c, i) => {
    setTimeout(() => c.classList.add('visible'), i * 80);
  });
}

function updateChartTitles(country, indicator, countryEl, indicatorEl) {
  const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
  const indName     = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;
  setEl('chart-main-title', `${indName}`);
  setEl('chart-main-sub',   `${countryName} · World Bank Data`);
}

async function loadSparklines(country, from, to) {
  // Load first 6 indicators for sparklines
  const indicatorKeys = Object.keys(PG.INDICATORS).slice(0, 6);
  const results = await PG.fetchMultiIndicator(country, indicatorKeys, from, to);
  const datasets = results.map((r, i) => ({
    ...r, indicator: indicatorKeys[i],
  }));
  PG.renderSparklines(datasets, '');
}

/* ── Chart type toggle ───────────────────────────────────── */
function initChartTypeBtns() {
  ['chart-line-btn', 'chart-bar-btn', 'chart-area-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      const type = id.includes('bar') ? 'bar' : id.includes('area') ? 'area' : 'line';
      dashState.type = type;
      if (dashState.series) PG.renderMainChart(dashState.series, type, dashState.indicator);
    });
  });
}

/* ============================================================
   FORECAST
   ============================================================ */
function initForecast() {
  const runBtn = document.getElementById('run-forecast-btn');
  if (runBtn) runBtn.addEventListener('click', runForecast);
}

async function runForecast() {
  const countryEl   = document.getElementById('fc-country');
  const indicatorEl = document.getElementById('fc-indicator');
  const horizonEl   = document.getElementById('fc-horizon');
  const alphaEl     = document.getElementById('fc-alpha');
  const betaEl      = document.getElementById('fc-beta');
  const ciEl        = document.getElementById('fc-ci');
  const btn         = document.getElementById('run-forecast-btn');
  const infoEl      = document.getElementById('forecast-model-info');
  const statsEl     = document.getElementById('forecast-stats');
  const emptyEl     = document.getElementById('forecast-empty');

  if (!countryEl || !indicatorEl) return;

  const country   = countryEl.value;
  const indicator = indicatorEl.value;
  const horizon   = parseInt(horizonEl?.value || 5);
  const alpha     = parseFloat(alphaEl?.value || 0.3);
  const beta      = parseFloat(betaEl?.value  || 0.1);
  const ci        = parseInt(ciEl?.value || 95);

  setButtonLoading(btn, true);
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    const series = await PG.fetchWorldBank(country, indicator, 1980, CURRENT_YEAR);
    if (series.length < 5) {
      showEmpty('forecast', 'Not enough data points for forecasting (need ≥ 5).');
      return;
    }

    const result = PG.holtwinters(series, { alpha, beta, horizon, ci });
    if (!result) {
      showEmpty('forecast', 'Forecasting failed — try different parameters.');
      return;
    }

    PG.renderForecastChart(result);

    // Update model info (target the h4 child, not the parent container)
    const titleEl = infoEl?.querySelector('.model-info-title');
    if (titleEl) titleEl.textContent = `Holt-Winters · α=${alpha} · β=${beta} · CI=${ci}%`;
    if (statsEl) {
      const lastFc = result.forecast[result.forecast.length - 1];
      statsEl.innerHTML = `
        <div class="model-stat"><div class="model-stat-val">${result.accuracy.mape}%</div><div class="model-stat-label">MAPE</div></div>
        <div class="model-stat"><div class="model-stat-val">${result.accuracy.rmse}</div><div class="model-stat-label">RMSE</div></div>
        <div class="model-stat"><div class="model-stat-val">${result.forecast[0].year}–${lastFc.year}</div><div class="model-stat-label">Horizon</div></div>
        <div class="model-stat"><div class="model-stat-val">${ci}%</div><div class="model-stat-label">Conf. Interval</div></div>
      `;
    }

    const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
    const indName     = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;
    setEl('fc-chart-title', `${indName} — Forecast to ${result.forecast[result.forecast.length - 1].year}`);
    PG.log(`Forecast complete: ${countryName} / ${indName} · MAPE: ${result.accuracy.mape}%`, 'model');

  } catch (err) {
    showEmpty('forecast', 'Failed to run forecast. Please try again.');
    PG.log(`Forecast error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   CORRELATION
   ============================================================ */
function initCorrelation() {
  const btn = document.getElementById('run-corr-btn');
  if (btn) btn.addEventListener('click', runCorrelation);
}

async function runCorrelation() {
  const countryEl  = document.getElementById('corr-country');
  const checkboxes = document.querySelectorAll('#corr-checkboxes input[type="checkbox"]:checked');
  const emptyEl    = document.getElementById('corr-empty');
  const btn        = document.getElementById('run-corr-btn');

  if (!countryEl) return;

  const country    = countryEl.value;
  const indicators = Array.from(checkboxes).map(c => c.value);

  if (indicators.length < 2) {
    PG.log('Select at least 2 indicators for correlation', 'warn');
    return;
  }

  setButtonLoading(btn, true);
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    const results = await PG.fetchMultiIndicator(country, indicators, 1990, CURRENT_YEAR);
    const datasets = results.map((r, i) => ({
      indicator: indicators[i],
      label: shortenLabel(r.label),
      data: r.data,
    }));

    const matrixResult = PG.pearsonMatrix(datasets);
    PG.renderHeatmap(matrixResult);
    PG.renderInsights(matrixResult.insights);

    const wrap = document.getElementById('heatmap-wrap');
    const corr = document.getElementById('heatmap-grid');
    if (wrap && corr && corr.children.length) {
      if (emptyEl) emptyEl.classList.add('hidden');
    }

    const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
    setEl('corr-title', `Correlation Matrix — ${countryName}`);
    PG.log(`Correlation matrix built: ${indicators.length} × ${indicators.length}`, 'model');

  } catch (err) {
    PG.log(`Correlation error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function shortenLabel(lbl) {
  const map = {
    'GDP (Current USD)': 'GDP', 'GDP Growth (%)': 'GDP %', 'GDP per Capita (USD)': 'GDP/cap',
    'Inflation Rate (%)': 'Inflation', 'Unemployment (%)': 'Unemployment',
    'Exports (% of GDP)': 'Exports', 'Imports (% of GDP)': 'Imports',
    'FDI Net Inflows (% GDP)': 'FDI', 'Government Debt (% GDP)': 'Debt',
    'Total Population': 'Population', 'Adult Literacy Rate (%)': 'Literacy',
    'Health Expenditure (% GDP)': 'Health', 'CO₂ Emissions (t per capita)': 'CO₂',
    'Electric Power Consumption': 'Electricity', 'Internet Users (%)': 'Internet',
  };
  return map[lbl] || lbl.slice(0, 12);
}

/* ============================================================
   ANOMALY DETECTION
   ============================================================ */
function initAnomaly() {
  const btn = document.getElementById('run-anomaly-btn');
  if (btn) btn.addEventListener('click', runAnomaly);
}

function initMethodToggle() {
  const btns = document.querySelectorAll('.method-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

async function runAnomaly() {
  const countryEl    = document.getElementById('an-country');
  const indicatorEl  = document.getElementById('an-indicator');
  const methodZEl    = document.getElementById('method-zscore');
  const methodIEl    = document.getElementById('method-iqr');
  const methodBEl    = document.getElementById('method-both');
  const thresholdEl  = document.getElementById('an-threshold');
  const summaryEl    = document.getElementById('anomaly-summary');
  const emptyEl      = document.getElementById('anomaly-empty');
  const btn          = document.getElementById('run-anomaly-btn');
  const listEl       = document.getElementById('anomaly-list');

  if (!countryEl || !indicatorEl) return;

  const country   = countryEl.value;
  const indicator = indicatorEl.value;
  const threshold = parseFloat(thresholdEl?.value || 2.5);
  let method = 'both';
  if (methodZEl?.classList.contains('active')) method = 'zscore';
  if (methodIEl?.classList.contains('active')) method = 'iqr';

  setButtonLoading(btn, true);
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    const series = await PG.fetchWorldBank(country, indicator, 1980, CURRENT_YEAR);
    if (series.length < 4) {
      showEmpty('anomaly', 'Not enough data for anomaly detection.');
      return;
    }

    const result = PG.detectAnomalies(series, { method, threshold });
    PG.renderAnomalyChart(series, result);

    const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
    const indName     = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;
    setEl('an-chart-title', `${indName} — Anomaly Detection (${countryName})`);

    // Render summary list
    if (listEl) {
      listEl.innerHTML = result.anomalies.length
        ? result.anomalies.map(a => `
          <div class="anomaly-item">
            <span class="anomaly-item-year">${a.year}</span>
            <span class="anomaly-item-val">${PG.format(a.value, indicator)}</span>
            <span class="anomaly-item-z">z=${a.z}</span>
          </div>`).join('')
        : '<div style="font-size:0.8rem;color:var(--white-50);padding:0.5rem">No anomalies detected at this threshold.</div>';
    }

    if (summaryEl) {
      summaryEl.querySelector('.panel-title')
        && (summaryEl.querySelector('.panel-title').textContent =
          `${result.anomalies.length} Anomalies Detected`);
    }

    PG.log(`Anomaly detection: ${result.anomalies.length} anomalies in ${series.length} points (${method.toUpperCase()})`, 'model');

  } catch (err) {
    showEmpty('anomaly', 'Failed to run anomaly detection.');
    PG.log(`Anomaly error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   COMPARATOR
   ============================================================ */
const compareState = { countries: [], colors: ['#00D4FF','#A78BFA','#6EE7B7','#F59E0B','#F472B6','#34D399'] };

function initCompare() {
  const addBtn  = document.getElementById('add-compare-country');
  const runBtn  = document.getElementById('run-compare-btn');

  if (addBtn) {
    addBtn.addEventListener('change', () => {
      const code = addBtn.value;
      const name = addBtn.options[addBtn.selectedIndex]?.text;
      if (!code || compareState.countries.find(c => c.code === code)) {
        addBtn.value = '';
        return;
      }
      if (compareState.countries.length >= 6) {
        PG.log('Maximum 6 countries for comparison', 'warn');
        addBtn.value = '';
        return;
      }
      compareState.countries.push({ code, name });
      renderCountryTags();
      addBtn.value = '';
    });
  }

  if (runBtn) runBtn.addEventListener('click', runCompare);

  // Pre-add 3 default countries
  [
    { code: 'GBR', name: 'United Kingdom' },
    { code: 'USA', name: 'United States' },
    { code: 'DEU', name: 'Germany' },
  ].forEach(c => compareState.countries.push(c));
  renderCountryTags();
}

function renderCountryTags() {
  const list = document.getElementById('country-tags-list');
  if (!list) return;
  list.innerHTML = compareState.countries.map((c, i) => `
    <span class="country-tag" style="color:${compareState.colors[i]};border-color:${compareState.colors[i]}40;background:${compareState.colors[i]}15"
          data-code="${c.code}">
      ${c.name}
      <span class="country-tag-remove" onclick="PG.removeCompareCountry('${c.code}')">×</span>
    </span>`).join('');
}

PG.removeCompareCountry = function(code) {
  compareState.countries = compareState.countries.filter(c => c.code !== code);
  renderCountryTags();
};

async function runCompare() {
  const indicatorEl = document.getElementById('cmp-indicator');
  const normaliseEl = document.getElementById('cmp-normalise');
  const emptyEl     = document.getElementById('compare-empty');
  const rankBody    = document.getElementById('rank-table-body');
  const btn         = document.getElementById('run-compare-btn');

  if (!indicatorEl || compareState.countries.length < 2) {
    PG.log('Select at least 2 countries to compare', 'warn');
    return;
  }

  const indicator = indicatorEl.value;
  const normalise = normaliseEl?.checked || false;

  setButtonLoading(btn, true);
  if (emptyEl) emptyEl.classList.add('hidden');

  try {
    const codes = compareState.countries.map(c => c.code);
    const results = await PG.fetchMultiCountry(codes, indicator, 1990, CURRENT_YEAR);

    const datasets = results.map((r, i) => ({
      country: compareState.countries[i]?.name || r.country,
      data: r.data,
    }));

    PG.renderCompareChart(datasets, normalise);

    const indName = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;
    setEl('cmp-chart-title', `${indName} — Country Comparison${normalise ? ' (Indexed)' : ''}`);

    // Build rank table
    if (rankBody) {
      const ranked = datasets
        .map(d => {
          const vals   = d.data.filter(p => p.value !== null);
          const latest = vals[vals.length - 1];
          const cagr   = PG.calcCAGR(d.data);
          return { name: d.country, latest, cagr };
        })
        .filter(r => r.latest)
        .sort((a, b) => b.latest.value - a.latest.value);

      rankBody.innerHTML = ranked.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.name}</td>
          <td>${PG.format(r.latest.value, indicator)}</td>
          <td>${r.latest.year}</td>
          <td class="rank-trend ${r.cagr >= 0 ? 'up' : 'down'}">
            ${r.cagr !== null ? (r.cagr >= 0 ? '↑' : '↓') + Math.abs(r.cagr).toFixed(1) + '%' : 'N/A'}
          </td>
        </tr>`).join('');
    }

    setEl('rank-table-title', `Ranking by Latest ${indName}`);
    PG.log(`Compare chart: ${datasets.length} countries · ${indName}`, 'success');

  } catch (err) {
    showEmpty('compare', 'Failed to fetch comparison data.');
    PG.log(`Compare error: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   PIPELINE SECTION
   ============================================================ */
function initPipelineSection() {
  const clearBtn = document.getElementById('clear-log-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const log = document.getElementById('pipeline-log');
      if (log) log.innerHTML = '';
    });
  }
  updateSessionStats();
}

function updateSessionStats() {
  ['requests', 'nulls', 'models', 'charts'].forEach(key => {
    const el = document.getElementById(`final-${key}`);
    if (el) el.textContent = (PG.metrics[key] || 0).toLocaleString();
  });

  // Update pipeline stage metrics
  PG.updateMetricEl('pm-requests', PG.metrics.requests);
  PG.updateMetricEl('pm-nulls',    PG.metrics.nulls);
  PG.updateMetricEl('pm-models',   PG.metrics.models);
  PG.updateMetricEl('pm-charts',   PG.metrics.charts);
}

// Update stats periodically
setInterval(updateSessionStats, 3000);

/* ============================================================
   SLIDERS
   ============================================================ */
function initSliders() {
  const sliderMap = [
    { sliderId: 'fc-horizon',   valId: 'fc-horizon-val',   suffix: ' yrs', dp: 0 },
    { sliderId: 'fc-alpha',     valId: 'fc-alpha-val',     suffix: '', dp: 1 },
    { sliderId: 'fc-beta',      valId: 'fc-beta-val',      suffix: '', dp: 1 },
    { sliderId: 'an-threshold', valId: 'an-threshold-val', suffix: 'σ',  dp: 1 },
  ];

  sliderMap.forEach(({ sliderId, valId, suffix, dp }) => {
    const slider = document.getElementById(sliderId);
    const valEl  = document.getElementById(valId);
    if (!slider || !valEl) return;
    const update = () => {
      valEl.textContent = parseFloat(slider.value).toFixed(dp) + suffix;
    };
    // Live visual feedback (instant), but debounce any heavy re-computation
    slider.addEventListener('input', update);
    update();
  });

  // Attach debounced auto-run to forecast sliders
  const autoRunForecast = debounce(() => {
    const btn = document.getElementById('run-forecast-btn');
    if (btn && !btn.disabled) runForecast();
  }, 600);
  ['fc-alpha', 'fc-beta', 'fc-horizon'].forEach(id => {
    const slider = document.getElementById(id);
    if (slider) slider.addEventListener('input', autoRunForecast);
  });
}

/* ============================================================
   NORMALISE TOGGLE
   ============================================================ */
function initNormaliseToggle() {
  const toggleEl = document.getElementById('cmp-normalise');
  const thumbEl  = toggleEl?.parentElement?.querySelector('.toggle-thumb');
  if (!toggleEl) return;
  toggleEl.addEventListener('change', () => {
    if (compareState.countries.length >= 2) runCompare();
  });
}

/* ============================================================
   REVEAL (IntersectionObserver)
   ============================================================ */
function initReveal() {
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => obs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }
}

/* ============================================================
   BACK TO TOP
   ============================================================ */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ============================================================
   TOOLTIP
   ============================================================ */
function initTooltip() {
  const tip = document.getElementById('tooltip');
  if (!tip) return;
  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
      tip.textContent = e.target.dataset.tip;
      tip.style.opacity = '1';
    });
    el.addEventListener('mousemove', e => {
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top  = (e.clientY - 28) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  });
}

/* ============================================================
   OFFLINE BANNER
   ============================================================ */
function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  function toggleBanner() {
    banner.classList.toggle('visible', !navigator.onLine);
  }

  window.addEventListener('online',  toggleBanner);
  window.addEventListener('offline', toggleBanner);
  toggleBanner(); // check initial state
}

/* ============================================================
   PARTICLES
   ============================================================ */
function initParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;
  const count = window.innerWidth < 640 ? 12 : 24;
  for (let i = 0; i < count; i++) {
    const p   = document.createElement('span');
    const size = Math.random() * 3 + 1;
    const dur  = Math.random() * 12 + 8;
    const del  = Math.random() * 10;
    p.className = 'hero-particle';
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      bottom:${Math.random() * 20}%;
      animation-duration:${dur}s;
      animation-delay:-${del}s;
      opacity:${Math.random() * 0.4 + 0.1};
    `;
    container.appendChild(p);
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

/** Debounce — delay fn execution until pause in calls */
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), ms);
  };
}

/** CSV Export — download current dashboard data as CSV */
PG.exportCSV = function() {
  if (!dashState.series || !dashState.series.length) {
    PG.log('No data to export. Load dashboard data first.', 'warn');
    return;
  }
  const indName = document.getElementById('indicator-select')?.selectedOptions[0]?.text || 'data';
  const country = document.getElementById('country-select')?.selectedOptions[0]?.text || '';
  const rows = [['Year', indName]];
  dashState.series.forEach(d => rows.push([d.year, d.value ?? '']));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulsegrid_${country.replace(/\s+/g,'_')}_${indName.replace(/\s+/g,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  PG.log(`Exported ${dashState.series.length} rows to CSV`, 'success');
};

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = '<span class="btn-spinner">⟳</span> Loading…';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText || 'Run';
    btn.disabled = false;
    updateSessionStats();
  }
}

function showEmpty(section, msg) {
  const idMap = { main: 'chart-empty', forecast: 'forecast-empty', anomaly: 'anomaly-empty', compare: 'compare-empty' };
  const el = document.getElementById(idMap[section]);
  if (el) {
    el.classList.remove('hidden');
    const p = el.querySelector('p');
    if (p && msg) p.textContent = msg;
  }
}

function hideEmpty(section) {
  const idMap = { main: 'chart-empty', forecast: 'forecast-empty', anomaly: 'anomaly-empty', compare: 'compare-empty' };
  const el = document.getElementById(idMap[section]);
  if (el) el.classList.add('hidden');
}
