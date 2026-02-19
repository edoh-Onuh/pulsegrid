/* ============================================================
   PulseGrid — Embeddable Widget System
   Generates self-contained, iframe-ready chart widgets that
   journalists, researchers, and NGOs can embed in their sites.
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ── Widget configuration ────────────────────────────────── */
PG.EMBED_VERSION = '1.0';
PG.EMBED_BASE = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');

/**
 * Generate embed code for current dashboard view
 */
PG.generateEmbed = function() {
  const countryEl = document.getElementById('country-select');
  const indicatorEl = document.getElementById('indicator-select');
  const fromEl = document.getElementById('year-from');
  const toEl = document.getElementById('year-to');

  if (!countryEl || !indicatorEl) return null;

  const country = countryEl.value;
  const indicator = indicatorEl.value;
  const countryName = countryEl.options[countryEl.selectedIndex]?.text || country;
  const indicatorName = indicatorEl.options[indicatorEl.selectedIndex]?.text || indicator;
  const from = fromEl?.value || 2000;
  const to = toEl?.value || new Date().getFullYear();

  const params = new URLSearchParams({
    country, indicator, from, to,
    theme: 'dark',
    v: PG.EMBED_VERSION,
  });

  const embedUrl = `${PG.EMBED_BASE}embed.html?${params.toString()}`;

  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="480" frameborder="0" style="border-radius:12px;border:1px solid rgba(0,212,255,0.15);" title="PulseGrid: ${indicatorName} — ${countryName}"></iframe>`;

  const scriptCode = `<!-- PulseGrid Widget -->
<div id="pulsegrid-widget" data-country="${country}" data-indicator="${indicator}" data-from="${from}" data-to="${to}"></div>
<script src="${PG.EMBED_BASE}js/widget-loader.js"><\/script>`;

  return {
    url: embedUrl,
    iframe: iframeCode,
    script: scriptCode,
    country, countryName, indicator, indicatorName, from, to,
  };
};

/**
 * Show embed modal
 */
PG.showEmbedModal = function() {
  const embed = PG.generateEmbed();
  if (!embed) {
    PG.log('Load data first before generating embed code', 'warn');
    return;
  }

  // Remove existing modal
  const existing = document.getElementById('embed-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'embed-modal';
  modal.className = 'embed-modal-overlay';
  modal.innerHTML = `
    <div class="embed-modal">
      <div class="embed-modal-header">
        <h3 class="embed-modal-title">📌 Embed This Chart</h3>
        <button class="embed-modal-close" onclick="this.closest('.embed-modal-overlay').remove()" aria-label="Close">&times;</button>
      </div>
      <div class="embed-modal-body">
        <p class="embed-modal-desc">Embed this PulseGrid visualisation in your website, blog, or research paper. The widget auto-updates with live World Bank data.</p>

        <div class="embed-preview">
          <div class="embed-preview-header">
            <span class="embed-preview-badge">PREVIEW</span>
            <span class="embed-preview-info">${embed.indicatorName} — ${embed.countryName} (${embed.from}–${embed.to})</span>
          </div>
          <iframe src="${embed.url}" width="100%" height="320" frameborder="0" style="border-radius:8px;border:1px solid rgba(0,212,255,0.1);"></iframe>
        </div>

        <div class="embed-code-section">
          <h4 class="embed-code-label">Option 1: iframe (recommended)</h4>
          <div class="embed-code-wrap">
            <pre class="embed-code" id="embed-iframe-code">${escapeHtml(embed.iframe)}</pre>
            <button class="embed-copy-btn" onclick="PG.copyEmbed('embed-iframe-code')">📋 Copy</button>
          </div>
        </div>

        <div class="embed-code-section">
          <h4 class="embed-code-label">Option 2: Script tag</h4>
          <div class="embed-code-wrap">
            <pre class="embed-code" id="embed-script-code">${escapeHtml(embed.script)}</pre>
            <button class="embed-copy-btn" onclick="PG.copyEmbed('embed-script-code')">📋 Copy</button>
          </div>
        </div>

        <div class="embed-code-section">
          <h4 class="embed-code-label">Direct link</h4>
          <div class="embed-code-wrap">
            <pre class="embed-code" id="embed-url-code">${embed.url}</pre>
            <button class="embed-copy-btn" onclick="PG.copyEmbed('embed-url-code')">📋 Copy</button>
          </div>
        </div>
      </div>
      <div class="embed-modal-footer">
        <span class="embed-license">Data: World Bank Open Data · CC BY 4.0 · Powered by PulseGrid</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  // Close on Escape
  const handler = e => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', handler); } };
  document.addEventListener('keydown', handler);

  PG.log('Embed code generated', 'success');
};

/**
 * Copy embed code to clipboard
 */
PG.copyEmbed = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement.querySelector('.embed-copy-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
    PG.log('Embed code copied to clipboard', 'success');
  }).catch(() => {
    // Fallback
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    PG.log('Embed code copied', 'success');
  });
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

PG.log && PG.log('Embeddable Widget System loaded', 'success');
