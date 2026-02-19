#!/usr/bin/env python3
"""
PulseGrid Enhancement Integration Script
Adds Insights and Recession tabs + UI functions to complete the integration
"""

import re
from pathlib import Path

PULSEGRID_DIR = Path(__file__).parent

def add_insights_section():
    """Add Insights tab section to index.html"""
    index_file = PULSEGRID_DIR / 'index.html'
    html = index_file.read_text(encoding='utf-8')
    
    # Find where to insert (before the "PIPELINE" section)
    pipeline_marker = '<!-- ═══════════════════════════════════════════\n     PIPELINE\n═══════════════════════════════════════════ -->'
    
    insights_html = '''<!-- ═══════════════════════════════════════════
     INSIGHTS — AI NARRATIVE REPORTS
═══════════════════════════════════════════ -->
<section id="insights" class="section-wrap" data-reveal>
  <div class="container">
    <header class="section-header">
      <span class="eyebrow">06 — AI Intelligence</span>
      <h2 class="section-title">Narrative <span class="accent">Insights</span></h2>
      <p class="section-lead">AI-powered economic narrative generation. Rule-based NLG engine produces human-readable analytical reports from raw data — no external API required.</p>
    </header>

    <div class="tab-controls-bar" role="group" aria-label="Insights controls">
      <div class="control-group">
        <label class="control-label" for="insights-country">Country</label>
        <div class="select-wrap">
          <select id="insights-country" class="control-select country-select-target">
            <option value="">Loading...</option>
          </select>
        </div>
      </div>
      <div class="control-group">
        <label class="control-label" for="insights-indicator">Indicator</label>
        <div class="select-wrap">
          <select id="insights-indicator" class="control-select">
            <option value="NY.GDP.MKTP.CD">GDP (current US$)</option>
            <option value="NY.GDP.MKTP.KD.ZG">GDP Growth (%)</option>
            <option value="NY.GDP.PCAP.CD">GDP per Capita</option>
            <option value="FP.CPI.TOTL.ZG">Inflation Rate</option>
            <option value="SL.UEM.TOTL.ZS">Unemployment</option>
            <option value="SP.POP.TOTL">Population</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="generate-insights-btn">Generate Narrative Report</button>
    </div>

    <div class="narrative-output-panel" id="narrative-output" style="display:none;">
      <div class="narrative-header">
        <h3 class="narrative-title" id="narrative-title">Economic Intelligence Report</h3>
        <div class="narrative-meta">
          <span id="narrative-country"></span> · <span id="narrative-indicator"></span> · Generated <span id="narrative-timestamp"></span>
        </div>
      </div>

      <div class="narrative-executive" id="narrative-executive"></div>

      <div class="narrative-key-findings">
        <h4>🎯 Key Findings</h4>
        <ul id="narrative-findings"></ul>
      </div>

      <div class="narrative-sections" id="narrative-sections"></div>

      <div class="narrative-outlook">
        <h4>🔮 Outlook</h4>
        <p id="narrative-outlook-text"></p>
      </div>

      <div class="narrative-footer">
        <button class="btn btn-ghost btn-sm" onclick="PG.downloadNarrative()">📄 Export as PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="PG.copyNarrativeToClipboard()">📋 Copy to Clipboard</button>
      </div>
    </div>

    <div class="empty-state" id="insights-empty">
      <div class="empty-state-icon">🤖</div>
      <p>Select a country and indicator, then click "Generate Narrative Report" to produce an AI-powered economic intelligence analysis.</p>
    </div>
  </div>
</section>

'''
    
    if pipeline_marker in html:
        html = html.replace(pipeline_marker, insights_html + '\n' + pipeline_marker)
        index_file.write_text(html, encoding='utf-8')
        print('✅ Added Insights section to index.html')
    else:
        print('⚠️  Could not find insertion point for Insights section')


def add_recession_section():
    """Add Recession tab section to index.html"""
    index_file = PULSEGRID_DIR / 'index.html'
    html = index_file.read_text(encoding='utf-8')
    
    # Find where to insert (before the Insights section we just added)
    insights_marker = '<!-- ═══════════════════════════════════════════\n     INSIGHTS — AI NARRATIVE REPORTS\n═══════════════════════════════════════════ -->'
    
    recession_html = '''<!-- ═══════════════════════════════════════════
     RECESSION PREDICTOR
═══════════════════════════════════════════ -->
<section id="recession" class="section-wrap" data-reveal>
  <div class="container">
    <header class="section-header">
      <span class="eyebrow">05 — Predictive Analytics</span>
      <h2 class="section-title">Recession <span class="accent">Risk</span></h2>
      <p class="section-lead">Composite Leading Indicator (CLI) engine. Combines GDP growth, unemployment, inflation, trade balance, and debt signals to estimate recession probability.</p>
    </header>

    <div class="tab-controls-bar" role="group" aria-label="Recession predictor controls">
      <div class="control-group">
        <label class="control-label" for="recession-country">Country</label>
        <div class="select-wrap">
          <select id="recession-country" class="control-select country-select-target">
            <option value="">Loading...</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="run-recession-btn">Calculate Recession Risk</button>
    </div>

    <div class="recession-dashboard" id="recession-dashboard" style="display:none;">
      <div class="recession-gauge-panel">
        <div class="recession-gauge" id="recession-gauge">
          <svg viewBox="0 0 200 120" class="gauge-svg">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20" stroke-linecap="round"/>
            <path id="gauge-fill" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#00D4FF" stroke-width="20" stroke-linecap="round" stroke-dasharray="251.2" stroke-dashoffset="251.2" style="transition: stroke-dashoffset 1.5s ease;"/>
            <circle cx="100" cy="100" r="60" fill="rgba(0,0,0,0.4)"/>
            <text x="100" y="90" text-anchor="middle" font-size="32" font-weight="700" fill="#00D4FF" id="gauge-value">0%</text>
            <text x="100" y="110" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.5)" id="gauge-label">RECESSION RISK</text>
          </svg>
        </div>
        <div class="recession-status" id="recession-status">
          <span class="recession-status-icon" id="recession-icon">●</span>
          <span class="recession-status-text" id="recession-text">Calculating...</span>
        </div>
      </div>

      <div class="recession-indicators-grid" id="recession-indicators"></div>

      <div class="recession-time-series">
        <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: rgba(255,255,255,0.7);">Historical Recession Probability</h4>
        <canvas id="recession-chart" style="max-width: 100%; height: 280px;"></canvas>
      </div>

      <div class="recession-alerts" id="recession-alerts"></div>
    </div>

    <div class="empty-state" id="recession-empty">
      <div class="empty-state-icon">📊</div>
      <p>Select a country and click "Calculate Recession Risk" to see a comprehensive multi-indicator recession probability analysis.</p>
    </div>
  </div>
</section>

'''
    
    if insights_marker in html:
        html = html.replace(insights_marker, recession_html + '\n' + insights_marker)
        index_file.write_text(html, encoding='utf-8')
        print('✅ Added Recession section to index.html')
    else:
        print('⚠️  Could not find insertion point for Recession section')


def add_ui_functions():
    """Add initInsights() and initRecession() functions to app.js"""
    app_file = PULSEGRID_DIR / 'js' / 'app.js'
    js = app_file.read_text(encoding='utf-8')
    
    # Find where to insert (before the pipeline section function)
    insertion_point = 'function initPipelineSection()'
    
    new_functions = '''/* ============================================================
   INSIGHTS TAB — AI NARRATIVE GENERATION
   ============================================================ */
function initInsights() {
  const btn = document.getElementById('generate-insights-btn');
  if (!btn) return;
  btn.addEventListener('click', generateInsightsReport);
}

async function generateInsightsReport() {
  const btn = document.getElementById('generate-insights-btn');
  const countryEl = document.getElementById('insights-country');
  const indicatorEl = document.getElementById('insights-indicator');
  const outputPanel = document.getElementById('narrative-output');
  const emptyState = document.getElementById('insights-empty');

  if (!countryEl || !indicatorEl) return;

  const country = countryEl.value;
  const indicator = indicatorEl.value;
  const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
  const indicatorName = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;

  if (!country) {
    PG.log('Please select a country first', 'warn');
    return;
  }

  setButtonLoading(btn, true);
  PG.log(`Generating narrative report for ${countryName} ${indicatorName}...`, 'info');

  try {
    const CURRENT_YEAR = new Date().getFullYear();
    const series = await PG.fetchWorldBank(country, indicator, 1990, CURRENT_YEAR);
    
    if (!series || series.length === 0) {
      throw new Error('No data available');
    }

    const narrative = PG.generateNarrative({
      series,
      country,
      countryName,
      indicator,
      indicatorName,
    });

    // Populate UI
    document.getElementById('narrative-title').textContent = narrative.title || 'Economic Intelligence Report';
    document.getElementById('narrative-country').textContent = countryName;
    document.getElementById('narrative-indicator').textContent = indicatorName;
    document.getElementById('narrative-timestamp').textContent = new Date().toLocaleDateString();
    document.getElementById('narrative-executive').innerHTML = `<p>${narrative.executive || 'No executive summary available.'}</p>`;

    const findingsEl = document.getElementById('narrative-findings');
    findingsEl.innerHTML = '';
    (narrative.keyFindings || []).forEach(finding => {
      const li = document.createElement('li');
      li.textContent = finding;
      findingsEl.appendChild(li);
    });

    const sectionsEl = document.getElementById('narrative-sections');
    sectionsEl.innerHTML = '';
    (narrative.sections || []).forEach(section => {
      const div = document.createElement('div');
      div.className = 'narrative-section-block';
      div.innerHTML = `<h4>${section.title || ''}</h4><p>${section.content || ''}</p>`;
      sectionsEl.appendChild(div);
    });

    document.getElementById('narrative-outlook-text').textContent = narrative.outlook || 'No outlook available.';

    if (outputPanel) outputPanel.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    PG.log('Narrative report generated', 'success');
  } catch (err) {
    PG.log(`Failed to generate narrative: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ============================================================
   RECESSION TAB — COMPOSITE LEADING INDICATOR
   ============================================================ */
function initRecession() {
  const btn = document.getElementById('run-recession-btn');
  if (!btn) return;
  btn.addEventListener('click', runRecessionPredictor);
}

async function runRecessionPredictor() {
  const btn = document.getElementById('run-recession-btn');
  const countryEl = document.getElementById('recession-country');
  const dashboard = document.getElementById('recession-dashboard');
  const emptyState = document.getElementById('recession-empty');

  if (!countryEl) return;

  const country = countryEl.value;
  const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;

  if (!country) {
    PG.log('Please select a country first', 'warn');
    return;
  }

  setButtonLoading(btn, true);
  PG.log(`Calculating recession risk for ${countryName}...`, 'info');

  try {
    const result = await PG.predictRecession(country);

    if (!result || !result.currentProbability) {
      throw new Error('Insufficient data for recession prediction');
    }

    // Update gauge
    const prob = result.currentProbability;
    const gaugeEl = document.getElementById('gauge-fill');
    const gaugeValue = document.getElementById('gauge-value');
    const gaugeLabel = document.getElementById('gauge-label');
    const statusIcon = document.getElementById('recession-icon');
    const statusText = document.getElementById('recession-text');

    if (gaugeValue) gaugeValue.textContent = Math.round(prob * 100) + '%';
    if (gaugeLabel) gaugeLabel.textContent = 'RECESSION RISK';

    // Animate gauge (dashoffset from 251.2 to 0 = full circle)
    if (gaugeEl) {
      const dashOffset = 251.2 * (1 - prob);
      gaugeEl.style.strokeDashoffset = dashOffset;
      
      // Color based on risk
      if (prob >= 0.7) gaugeEl.style.stroke = '#ff4444';
      else if (prob >= 0.4) gaugeEl.style.stroke = '#ffaa00';
      else gaugeEl.style.stroke = '#00D4FF';
    }

    // Status text
    let statusClass = 'status-low';
    let statusMsg = 'Low Risk';
    if (prob >= 0.7) { statusClass = 'status-high'; statusMsg = 'High Risk — Recessionary signals detected'; }
    else if (prob >= 0.4) { statusClass = 'status-medium'; statusMsg = 'Moderate Risk — Monitor closely'; }

    if (statusIcon) {
      statusIcon.className = `recession-status-icon ${statusClass}`;
      statusIcon.textContent = prob >= 0.7 ? '🔴' : prob >= 0.4 ? '🟡' : '🟢';
    }
    if (statusText) {
      statusText.textContent = statusMsg;
      statusText.className = `recession-status-text ${statusClass}`;
    }

    // Populate indicator grid
    const indicatorsGrid = document.getElementById('recession-indicators');
    if (indicatorsGrid && result.indicators) {
      indicatorsGrid.innerHTML = '';
      result.indicators.forEach(ind => {
        const card = document.createElement('div');
        card.className = 'recession-indicator-card';
        const signal = ind.signal || 0;
        const signalClass = signal >= 0.7 ? 'signal-high' : signal >= 0.3 ? 'signal-medium' : 'signal-low';
        card.innerHTML = `
          <div class="rec-ind-header">
            <span class="rec-ind-name">${ind.name || ''}</span>
            <span class="rec-ind-signal ${signalClass}">${Math.round(signal * 100)}%</span>
          </div>
          <div class="rec-ind-value">${typeof ind.latestValue === 'number' ? ind.latestValue.toFixed(2) : 'N/A'}</div>
          <div class="rec-ind-delta">${ind.interpretation || ''}</div>
        `;
        indicatorsGrid.appendChild(card);
      });
    }

    // Historical chart
    if (result.timeSeries && result.timeSeries.length > 0) {
      const ctx = document.getElementById('recession-chart');
      if (ctx) {
        if (window.recessionChart) window.recessionChart.destroy();
        window.recessionChart = new Chart(ctx.getContext('2d'), {
          type: 'line',
          data: {
            labels: result.timeSeries.map(d => d.year),
            datasets: [{
              label: 'Recession Probability',
              data: result.timeSeries.map(d => (d.probability * 100).toFixed(1)),
              borderColor: '#00D4FF',
              backgroundColor: 'rgba(0,212,255,0.1)',
              fill: true,
              tension: 0.3,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => `Risk: ${ctx.parsed.y}%`,
                },
              },
            },
            scales: {
              y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
            },
          },
        });
      }
    }

    // Show alerts
    const alertsEl = document.getElementById('recession-alerts');
    if (alertsEl && result.alerts && result.alerts.length > 0) {
      alertsEl.innerHTML = '<h4 style="margin-bottom:0.5rem;font-size:0.9rem;color:rgba(255,255,255,0.7);">⚠️ Risk Factors</h4>';
      const ul = document.createElement('ul');
      ul.style.cssText = 'padding-left:1.2rem;color:rgba(255,255,255,0.8);font-size:0.85rem;line-height:1.6;';
      result.alerts.forEach(alert => {
        const li = document.createElement('li');
        li.textContent = alert;
        ul.appendChild(li);
      });
      alertsEl.appendChild(ul);
    }

    if (dashboard) dashboard.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    PG.log(`Recession risk: ${Math.round(prob * 100)}%`, prob >= 0.7 ? 'warn' : 'success');
  } catch (err) {
    PG.log(`Recession prediction failed: ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

'''
    
    if insertion_point in js:
        js = js.replace(insertion_point, new_functions + '\n' + insertion_point)
        app_file.write_text(js, encoding='utf-8')
        print('✅ Added initInsights() and initRecession() functions to app.js')
    else:
        print('⚠️  Could not find insertion point in app.js')


def add_css_styles():
    """Add CSS for new sections"""
    css_file = PULSEGRID_DIR / 'css' / 'styles.css'
    css = css_file.read_text(encoding='utf-8')
    
    new_styles = '''
/* ============================================================
   INSIGHTS & RECESSION TAB STYLES
   ============================================================ */
.narrative-output-panel {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(0,212,255,0.15);
  border-radius: 12px;
  padding: 2rem;
  margin-top: 2rem;
}

.narrative-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.narrative-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: #00D4FF;
  margin-bottom: 0.5rem;
}

.narrative-meta {
  font-size: 0.85rem;
  color: rgba(255,255,255,0.5);
  font-family: 'JetBrains Mono', monospace;
}

.narrative-executive {
  background: rgba(0,212,255,0.05);
  padding: 1.2rem;
  border-left: 3px solid #00D4FF;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 1rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.9);
}

.narrative-key-findings {
  margin-bottom: 1.5rem;
}

.narrative-key-findings h4,
.narrative-outlook h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin-bottom: 0.8rem;
}

.narrative-key-findings ul {
  list-style: none;
  padding: 0;
}

.narrative-key-findings li {
  padding: 0.6rem 0 0.6rem 1.5rem;
  position: relative;
  color: rgba(255,255,255,0.8);
  line-height: 1.6;
}

.narrative-key-findings li::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: #00D4FF;
  font-weight: 700;
}

.narrative-section-block {
  margin-bottom: 1.5rem;
}

.narrative-section-block h4 {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin-bottom: 0.5rem;
}

.narrative-section-block p {
  color: rgba(255,255,255,0.75);
  line-height: 1.7;
}

.narrative-outlook {
  background: rgba(0,212,255,0.04);
  padding: 1.2rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.narrative-footer {
  display: flex;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.1);
}

/* Recession Dashboard */
.recession-dashboard {
  margin-top: 2rem;
}

.recession-gauge-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
  border: 1px solid rgba(0,212,255,0.15);
}

.recession-gauge {
  width: 200px;
  height: 120px;
  margin-bottom: 1rem;
}

.recession-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.recession-status-icon {
  font-size: 1.4rem;
}

.status-low { color: #00D4FF; }
.status-medium { color: #ffaa00; }
.status-high { color: #ff4444; }

.recession-indicators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.recession-indicator-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 1rem;
}

.rec-ind-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.rec-ind-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
}

.rec-ind-signal {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

.signal-low { background: rgba(0,212,255,0.15); color: #00D4FF; }
.signal-medium { background: rgba(255,170,0,0.15); color: #ffaa00; }
.signal-high { background: rgba(255,68,68,0.15); color: #ff4444; }

.rec-ind-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.3rem;
}

.rec-ind-delta {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
}

.recession-time-series {
  background: rgba(255,255,255,0.02);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid rgba(0,212,255,0.15);
  margin-bottom: 1.5rem;
}

.recession-alerts {
  background: rgba(255,170,0,0.05);
  padding: 1.2rem;
  border-left: 3px solid #ffaa00;
  border-radius: 6px;
}
'''
    
    if not '/* INSIGHTS & RECESSION' in css:
        css += new_styles
        css_file.write_text(css, encoding='utf-8')
        print('✅ Added CSS styles for new sections')
    else:
        print('ℹ️  CSS styles already exist')


def main():
    print('🚀 PulseGrid Enhancement Integration\n')
    print('Adding Recession and Insights tabs...\n')
    
    add_recession_section()
    add_insights_section()
    add_ui_functions()
    add_css_styles()
    
    print('\n✨ Integration complete!')
    print('Next steps:')
    print('  1. Deploy to Netlify: npx netlify-cli deploy --prod --dir .')
    print('  2. Test backend: cd server && npm install && npm start')
    print('  3. Commit changes: git add -A && git commit -m "feat: add AI insights & recession prediction" && git push')

if __name__ == '__main__':
    main()
