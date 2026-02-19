/* ============================================================
   PulseGrid — Narrative Intelligence Module
   AI-powered economic narrative generation engine.
   Produces human-readable analytical reports from raw data —
   no external AI API required. Rule-based NLG with contextual
   awareness, causal reasoning, and domain-specific templates.
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ── Economic context knowledge base ─────────────────────── */
const ECON_CONTEXT = {
  'NY.GDP.MKTP.CD': {
    name: 'GDP', unit: 'USD', type: 'monetary',
    drivers: ['investment', 'consumer spending', 'exports', 'government expenditure'],
    declineReasons: ['currency devaluation', 'recession', 'conflict', 'pandemic', 'commodity price collapse', 'capital flight'],
    growthReasons: ['economic reform', 'commodity boom', 'FDI inflow', 'industrialisation', 'trade liberalisation'],
  },
  'NY.GDP.MKTP.KD.ZG': {
    name: 'GDP growth', unit: '%', type: 'rate',
    drivers: ['productivity', 'labour force', 'capital accumulation'],
    declineReasons: ['demand contraction', 'supply shock', 'fiscal austerity', 'political instability'],
    growthReasons: ['stimulus spending', 'structural reform', 'technology adoption'],
  },
  'NY.GDP.PCAP.CD': {
    name: 'GDP per capita', unit: 'USD', type: 'monetary',
    drivers: ['economic growth', 'population dynamics', 'productivity'],
    declineReasons: ['rapid population growth outpacing GDP', 'economic contraction', 'currency collapse'],
    growthReasons: ['economic diversification', 'human capital investment', 'urbanisation'],
  },
  'FP.CPI.TOTL.ZG': {
    name: 'inflation', unit: '%', type: 'rate',
    drivers: ['money supply', 'demand', 'supply chain', 'exchange rate'],
    declineReasons: ['tight monetary policy', 'demand weakness', 'commodity price drop'],
    growthReasons: ['loose monetary policy', 'supply disruption', 'currency depreciation', 'fiscal expansion'],
  },
  'SL.UEM.TOTL.ZS': {
    name: 'unemployment', unit: '%', type: 'rate',
    drivers: ['economic cycle', 'structural change', 'policy'],
    declineReasons: ['economic expansion', 'labour market reform', 'investment growth'],
    growthReasons: ['recession', 'automation', 'industry decline', 'pandemic lockdowns'],
  },
  'SP.POP.TOTL': {
    name: 'population', unit: '', type: 'count',
    drivers: ['fertility rate', 'mortality rate', 'migration'],
    declineReasons: ['emigration', 'low fertility rate', 'ageing population'],
    growthReasons: ['high fertility', 'immigration', 'improved healthcare'],
  },
};

/* ── Global events database ──────────────────────────────── */
const GLOBAL_EVENTS = {
  2020: { event: 'COVID-19 pandemic', impact: 'severe global economic contraction' },
  2019: { event: 'US-China trade tensions', impact: 'trade uncertainty' },
  2008: { event: 'Global Financial Crisis', impact: 'worldwide banking collapse and recession' },
  2009: { event: 'Great Recession trough', impact: 'deepest post-war economic contraction' },
  2014: { event: 'Oil price crash', impact: 'commodity-dependent economies contracted sharply' },
  2015: { event: 'China stock market crash', impact: 'emerging market capital outflows' },
  2022: { event: 'Russia-Ukraine war / energy crisis', impact: 'global energy price spike and inflation surge' },
  2023: { event: 'Global monetary tightening', impact: 'aggressive interest rate hikes worldwide' },
  2024: { event: 'Currency realignments in emerging markets', impact: 'naira, lira, peso devaluations' },
  1997: { event: 'Asian Financial Crisis', impact: 'currency collapse across Southeast Asia' },
  1998: { event: 'Russian financial crisis', impact: 'sovereign default and contagion' },
  2001: { event: 'Dot-com bust / 9-11', impact: 'global economic slowdown' },
  2011: { event: 'European sovereign debt crisis', impact: 'eurozone austerity and recession' },
};

/* ── Regional context ────────────────────────────────────── */
const REGIONAL_CONTEXT = {
  'NGA': { region: 'West Africa', currency: 'naira', oilDependent: true },
  'GBR': { region: 'Europe', currency: 'pound sterling', oilDependent: false },
  'USA': { region: 'North America', currency: 'US dollar', oilDependent: false },
  'ZAF': { region: 'Southern Africa', currency: 'rand', oilDependent: false },
  'BRA': { region: 'Latin America', currency: 'real', oilDependent: true },
  'SAU': { region: 'Middle East', currency: 'riyal', oilDependent: true },
  'CHN': { region: 'East Asia', currency: 'yuan', oilDependent: false },
  'IND': { region: 'South Asia', currency: 'rupee', oilDependent: false },
  'DEU': { region: 'Europe', currency: 'euro', oilDependent: false },
  'JPN': { region: 'East Asia', currency: 'yen', oilDependent: false },
};

/* ============================================================
   NARRATIVE GENERATION ENGINE
   ============================================================ */

/**
 * Generate a full narrative report from time-series data
 * @param {Object} params
 * @param {Array} params.series - [{year, value}, ...]
 * @param {string} params.country - country code
 * @param {string} params.countryName - full country name
 * @param {string} params.indicator - indicator code
 * @param {string} params.indicatorName - indicator display name
 * @returns {Object} { title, executive, sections[], keyFindings[], outlook }
 */
PG.generateNarrative = function({ series, country, countryName, indicator, indicatorName }) {
  if (!series || series.length < 3) {
    return { title: 'Insufficient Data', executive: 'Not enough data points to generate a narrative report.', sections: [], keyFindings: [], outlook: '' };
  }

  const vals = series.filter(d => d.value !== null && isFinite(d.value));
  if (vals.length < 3) {
    return { title: 'Insufficient Data', executive: 'Not enough valid data points.', sections: [], keyFindings: [], outlook: '' };
  }

  const stats = PG.calcStats(series);
  const cagr = PG.calcCAGR(series);
  const change = PG.calcChange(series);
  const vol = PG.calcVolatility(series);
  const ctx = ECON_CONTEXT[indicator] || { name: indicatorName, unit: '', type: 'value', drivers: [], declineReasons: [], growthReasons: [] };
  const regional = REGIONAL_CONTEXT[country] || {};
  const first = vals[0];
  const last = vals[vals.length - 1];

  // Detect structural breaks (>20% YoY changes)
  const breaks = detectBreaks(vals, indicator);
  // Detect trend phases
  const phases = detectPhases(vals);
  // Get relevant global events
  const events = matchEvents(vals, breaks);

  const title = `${countryName}: ${indicatorName} Analysis (${first.year}–${last.year})`;

  // Executive summary
  const executive = buildExecutiveSummary({ countryName, ctx, first, last, cagr, change, vol, stats, phases, breaks, events, regional });

  // Detailed sections
  const sections = [];

  // Section 1: Overview
  sections.push({
    heading: 'Overview',
    body: buildOverview({ countryName, ctx, first, last, stats, cagr, indicator }),
  });

  // Section 2: Trend Analysis
  sections.push({
    heading: 'Trend Analysis',
    body: buildTrendAnalysis({ phases, countryName, ctx, indicator }),
  });

  // Section 3: Notable Events & Structural Breaks
  if (breaks.length > 0) {
    sections.push({
      heading: 'Structural Breaks & Key Events',
      body: buildBreaksNarrative({ breaks, events, countryName, ctx, regional }),
    });
  }

  // Section 4: Volatility Assessment
  sections.push({
    heading: 'Volatility & Risk Assessment',
    body: buildVolatilityNarrative({ vol, stats, countryName, ctx }),
  });

  // Key findings
  const keyFindings = extractKeyFindings({ countryName, ctx, cagr, change, vol, breaks, phases, last, first, events, stats });

  // Outlook
  const outlook = buildOutlook({ countryName, ctx, phases, last, cagr, vol, regional, events });

  return { title, executive, sections, keyFindings, outlook };
};

/* ── Detect structural breaks ────────────────────────────── */
function detectBreaks(vals, indicator) {
  const breaks = [];
  for (let i = 1; i < vals.length; i++) {
    const prev = vals[i-1].value;
    const curr = vals[i].value;
    if (prev === 0 || prev === null) continue;
    const pctChange = ((curr - prev) / Math.abs(prev)) * 100;
    const threshold = indicator.includes('ZG') || indicator.includes('ZS') ? 30 : 20;
    if (Math.abs(pctChange) >= threshold) {
      breaks.push({
        year: vals[i].year,
        prevYear: vals[i-1].year,
        value: curr,
        prevValue: prev,
        pctChange,
        direction: pctChange > 0 ? 'surge' : 'decline',
      });
    }
  }
  return breaks;
}

/* ── Detect trend phases ─────────────────────────────────── */
function detectPhases(vals) {
  if (vals.length < 5) return [{ type: 'flat', start: vals[0].year, end: vals[vals.length-1].year }];

  const phases = [];
  let currentDirection = null;
  let phaseStart = vals[0].year;
  let consecutiveCount = 0;
  const WINDOW = 3;

  for (let i = WINDOW; i < vals.length; i++) {
    // Moving average comparison
    const prev = vals.slice(i - WINDOW, i).reduce((s, d) => s + d.value, 0) / WINDOW;
    const curr = vals[i].value;
    const dir = curr > prev * 1.02 ? 'growth' : curr < prev * 0.98 ? 'decline' : 'stable';

    if (dir !== currentDirection) {
      if (currentDirection !== null && consecutiveCount >= 2) {
        phases.push({ type: currentDirection, start: phaseStart, end: vals[i-1].year });
      }
      currentDirection = dir;
      phaseStart = vals[i-1].year;
      consecutiveCount = 1;
    } else {
      consecutiveCount++;
    }
  }
  // Close last phase
  if (currentDirection && consecutiveCount >= 2) {
    phases.push({ type: currentDirection, start: phaseStart, end: vals[vals.length-1].year });
  }

  return phases.length > 0 ? phases : [{ type: 'mixed', start: vals[0].year, end: vals[vals.length-1].year }];
}

/* ── Match global events to breaks ───────────────────────── */
function matchEvents(vals, breaks) {
  const matched = [];
  const yearRange = new Set(vals.map(d => d.year));
  for (const [year, evt] of Object.entries(GLOBAL_EVENTS)) {
    const y = parseInt(year);
    if (yearRange.has(y)) {
      const nearBreak = breaks.find(b => Math.abs(b.year - y) <= 1);
      matched.push({ ...evt, year: y, linkedBreak: nearBreak || null });
    }
  }
  return matched;
}

/* ── Build executive summary ─────────────────────────────── */
function buildExecutiveSummary({ countryName, ctx, first, last, cagr, change, vol, stats, phases, breaks, events, regional }) {
  const parts = [];

  // Opening
  const direction = change.pct > 5 ? 'expanded significantly' : change.pct > 0 ? 'grew modestly' : change.pct > -5 ? 'remained relatively stable' : 'contracted notably';
  parts.push(`${countryName}'s ${ctx.name} ${direction} over the ${last.year - first.year}-year observation period (${first.year}–${last.year}), moving from ${formatNarrative(first.value, ctx)} to ${formatNarrative(last.value, ctx)}.`);

  // CAGR
  if (cagr !== null) {
    const cagrDesc = Math.abs(cagr) < 1 ? 'near-zero' : Math.abs(cagr) < 3 ? 'modest' : Math.abs(cagr) < 7 ? 'healthy' : 'exceptional';
    parts.push(`The compound annual growth rate (CAGR) stands at ${cagr >= 0 ? '+' : ''}${cagr.toFixed(2)}%, indicating ${cagrDesc} ${cagr >= 0 ? 'expansion' : 'contraction'}.`);
  }

  // Volatility
  if (vol !== null) {
    const volDesc = vol < 5 ? 'low' : vol < 15 ? 'moderate' : vol < 30 ? 'high' : 'extreme';
    parts.push(`Volatility is ${volDesc} at ${vol.toFixed(1)}%, ${volDesc === 'low' ? 'suggesting stable and predictable dynamics' : volDesc === 'extreme' ? 'reflecting significant macroeconomic instability' : 'indicating periodic fluctuations'}.`);
  }

  // Key breaks
  if (breaks.length > 0) {
    const majorBreak = breaks.reduce((a, b) => Math.abs(a.pctChange) > Math.abs(b.pctChange) ? a : b);
    const matchedEvent = events.find(e => Math.abs(e.year - majorBreak.year) <= 1);
    parts.push(`The most significant structural break occurred in ${majorBreak.year} — a ${majorBreak.direction} of ${Math.abs(majorBreak.pctChange).toFixed(1)}%${matchedEvent ? `, coinciding with the ${matchedEvent.event}` : ''}.`);
  }

  return parts.join(' ');
}

/* ── Build overview section ──────────────────────────────── */
function buildOverview({ countryName, ctx, first, last, stats, cagr, indicator }) {
  const parts = [];
  parts.push(`This analysis examines ${countryName}'s ${ctx.name} over a ${last.year - first.year}-year period from ${first.year} to ${last.year}, drawing on World Bank open data processed through PulseGrid's ETL pipeline.`);
  parts.push(`The dataset comprises ${stats.n} annual observations. The mean value is ${formatNarrative(stats.mean, ctx)}, with a median of ${formatNarrative(stats.median, ctx)}. The data ranges from a minimum of ${formatNarrative(stats.min, ctx)} to a maximum of ${formatNarrative(stats.max, ctx)}, representing a ${((stats.max - stats.min) / Math.abs(stats.min || 1) * 100).toFixed(0)}% range span.`);

  if (ctx.drivers.length > 0) {
    parts.push(`Key structural drivers of ${ctx.name} typically include ${ctx.drivers.slice(0, 3).join(', ')}, with significant influence from macroeconomic policy and external conditions.`);
  }

  return parts.join(' ');
}

/* ── Build trend analysis ────────────────────────────────── */
function buildTrendAnalysis({ phases, countryName, ctx, indicator }) {
  if (phases.length === 0) return 'Insufficient data for trend decomposition.';
  const parts = [];
  parts.push(`The time series reveals ${phases.length} distinct phase${phases.length > 1 ? 's' : ''}:`);

  phases.forEach((p, i) => {
    const duration = p.end - p.start;
    const phaseDesc = p.type === 'growth' ? 'an expansion phase' : p.type === 'decline' ? 'a contraction phase' : 'a period of relative stability';
    parts.push(`Phase ${i + 1} (${p.start}–${p.end}): ${duration}-year ${phaseDesc}. ${getPhaseContext(p, ctx, countryName)}`);
  });

  return parts.join('\n\n');
}

function getPhaseContext(phase, ctx, countryName) {
  if (phase.type === 'growth') {
    const reason = ctx.growthReasons[Math.floor(Math.random() * ctx.growthReasons.length)] || 'favourable macroeconomic conditions';
    return `This expansion was likely driven by ${reason}, reflecting improved economic fundamentals in ${countryName}.`;
  } else if (phase.type === 'decline') {
    const reason = ctx.declineReasons[Math.floor(Math.random() * ctx.declineReasons.length)] || 'adverse economic conditions';
    return `This contraction may be attributed to ${reason}, which constrained economic performance.`;
  }
  return `This stability period suggests balanced forces in ${countryName}'s economy with no dominant trend.`;
}

/* ── Build breaks narrative ──────────────────────────────── */
function buildBreaksNarrative({ breaks, events, countryName, ctx, regional }) {
  const parts = [];
  parts.push(`PulseGrid's anomaly detection identified ${breaks.length} structural break${breaks.length > 1 ? 's' : ''} — years where year-on-year change exceeded the threshold for ${ctx.name}:`);

  breaks.forEach(b => {
    const matchedEvent = events.find(e => Math.abs(e.year - b.year) <= 1);
    let explanation = '';
    if (matchedEvent) {
      explanation = ` This aligns with the ${matchedEvent.event}, which caused ${matchedEvent.impact}.`;
    } else if (regional.oilDependent && b.direction === 'decline') {
      explanation = ` As an oil-dependent economy, ${countryName} is particularly vulnerable to commodity price shocks and currency pressures.`;
    } else if (regional.currency && b.direction === 'decline') {
      explanation = ` ${regional.currency.charAt(0).toUpperCase() + regional.currency.slice(1)} depreciation may have contributed to this decline in USD-denominated terms.`;
    }
    parts.push(`• ${b.year}: ${b.direction === 'surge' ? 'Sharp increase' : 'Sharp decline'} of ${Math.abs(b.pctChange).toFixed(1)}% (${formatNarrative(b.prevValue, ctx)} → ${formatNarrative(b.value, ctx)}).${explanation}`);
  });

  return parts.join('\n');
}

/* ── Build volatility narrative ──────────────────────────── */
function buildVolatilityNarrative({ vol, stats, countryName, ctx }) {
  if (vol === null) return 'Insufficient data for volatility assessment.';
  const parts = [];

  const category = vol < 5 ? 'low' : vol < 15 ? 'moderate' : vol < 30 ? 'high' : 'extreme';
  const cv = stats.mean !== 0 ? (stats.std / Math.abs(stats.mean) * 100).toFixed(1) : 'N/A';

  parts.push(`${countryName}'s ${ctx.name} exhibits ${category} volatility with a year-on-year standard deviation of ${vol.toFixed(2)}%. The coefficient of variation is ${cv}%, providing a normalised measure of dispersion.`);

  if (category === 'high' || category === 'extreme') {
    parts.push(`This level of volatility suggests significant macroeconomic risk. Investors and policymakers should factor in substantial uncertainty when using historical trends for forward projections.`);
  } else if (category === 'low') {
    parts.push(`This low volatility indicates a stable and predictable trajectory, lending confidence to trend-based projections and long-term planning.`);
  }

  return parts.join(' ');
}

/* ── Extract key findings ────────────────────────────────── */
function extractKeyFindings({ countryName, ctx, cagr, change, vol, breaks, phases, last, first, events, stats }) {
  const findings = [];

  // Direction finding
  if (change.pct !== null) {
    const dir = change.pct > 0 ? 'increased' : 'decreased';
    findings.push({
      icon: change.pct > 0 ? '📈' : '📉',
      text: `${ctx.name} ${dir} by ${Math.abs(change.pct).toFixed(1)}% over the full period (${first.year}–${last.year}).`,
      severity: Math.abs(change.pct) > 50 ? 'high' : 'medium',
    });
  }

  // CAGR finding
  if (cagr !== null) {
    findings.push({
      icon: '📊',
      text: `Compound annual growth rate: ${cagr >= 0 ? '+' : ''}${cagr.toFixed(2)}%.`,
      severity: 'info',
    });
  }

  // Volatility finding
  if (vol !== null && vol > 15) {
    findings.push({
      icon: '⚠️',
      text: `High volatility detected (${vol.toFixed(1)}%) — significant economic instability in the time series.`,
      severity: 'high',
    });
  }

  // Break findings
  breaks.slice(0, 3).forEach(b => {
    const evt = events.find(e => Math.abs(e.year - b.year) <= 1);
    findings.push({
      icon: '🔴',
      text: `${b.year}: ${Math.abs(b.pctChange).toFixed(1)}% ${b.direction}${evt ? ` (${evt.event})` : ''}.`,
      severity: 'high',
    });
  });

  // Peak/trough
  findings.push({
    icon: '🏔️',
    text: `Peak: ${formatNarrative(stats.max, ctx)} | Trough: ${formatNarrative(stats.min, ctx)}.`,
    severity: 'info',
  });

  return findings.slice(0, 6);
}

/* ── Build outlook ───────────────────────────────────────── */
function buildOutlook({ countryName, ctx, phases, last, cagr, vol, regional, events }) {
  const parts = [];
  const recentPhase = phases[phases.length - 1];

  if (recentPhase) {
    const trajectory = recentPhase.type === 'growth' ? 'positive trajectory' : recentPhase.type === 'decline' ? 'concerning downward trajectory' : 'period of consolidation';
    parts.push(`${countryName}'s ${ctx.name} is currently on a ${trajectory} (since ~${recentPhase.start}).`);
  }

  if (cagr !== null) {
    if (cagr > 3) {
      parts.push(`If the historical CAGR of ${cagr.toFixed(2)}% persists, ${ctx.name} would approximately ${cagr > 7 ? 'double within a decade' : 'grow substantially over the next decade'}. However, past performance is not indicative of future results.`);
    } else if (cagr < -2) {
      parts.push(`The negative CAGR of ${cagr.toFixed(2)}% signals structural challenges that, if unaddressed, could lead to continued deterioration. Policy intervention may be needed.`);
    }
  }

  if (vol !== null && vol > 20) {
    parts.push(`The high historical volatility (${vol.toFixed(1)}%) warrants caution — confidence intervals on any forward projection should be wide.`);
  }

  parts.push(`This analysis was generated by PulseGrid's narrative intelligence engine from ${last.year} World Bank data. For forecasting, see the Holt-Winters prediction module.`);

  return parts.join(' ');
}

/* ── Format helper ───────────────────────────────────────── */
function formatNarrative(value, ctx) {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A';
  if (ctx.type === 'rate') return value.toFixed(2) + '%';
  if (ctx.type === 'monetary') {
    if (Math.abs(value) >= 1e12) return '$' + (value / 1e12).toFixed(2) + ' trillion';
    if (Math.abs(value) >= 1e9) return '$' + (value / 1e9).toFixed(2) + ' billion';
    if (Math.abs(value) >= 1e6) return '$' + (value / 1e6).toFixed(2) + ' million';
    return '$' + value.toFixed(2);
  }
  if (ctx.type === 'count') {
    if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + ' billion';
    if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + ' million';
    return value.toLocaleString();
  }
  return value.toFixed(2);
}

/* ── Render full report to DOM ───────────────────────────── */
PG.renderNarrativeReport = function(report) {
  const container = document.getElementById('narrative-output');
  if (!container) return;

  let html = '';

  // Title
  html += `<h3 class="narrative-title">${report.title}</h3>`;

  // Executive summary
  html += `<div class="narrative-section narrative-executive">
    <h4 class="narrative-heading">Executive Summary</h4>
    <p class="narrative-body">${report.executive}</p>
  </div>`;

  // Key findings
  if (report.keyFindings.length > 0) {
    html += `<div class="narrative-section narrative-findings">
      <h4 class="narrative-heading">Key Findings</h4>
      <div class="narrative-findings-grid">
        ${report.keyFindings.map(f => `
          <div class="narrative-finding ${f.severity}">
            <span class="narrative-finding-icon">${f.icon}</span>
            <span class="narrative-finding-text">${f.text}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  // Detailed sections
  report.sections.forEach(sec => {
    html += `<div class="narrative-section">
      <h4 class="narrative-heading">${sec.heading}</h4>
      <div class="narrative-body">${sec.body.split('\n\n').map(p => `<p>${p}</p>`).join('')}</div>
    </div>`;
  });

  // Outlook
  if (report.outlook) {
    html += `<div class="narrative-section narrative-outlook">
      <h4 class="narrative-heading">📡 Outlook</h4>
      <p class="narrative-body">${report.outlook}</p>
    </div>`;
  }

  // Timestamp
  html += `<div class="narrative-footer">
    <span>Generated by PulseGrid Narrative Intelligence Engine · ${new Date().toISOString().slice(0, 10)}</span>
  </div>`;

  container.innerHTML = html;
};

PG.log && PG.log('Narrative Intelligence Engine loaded', 'success');
