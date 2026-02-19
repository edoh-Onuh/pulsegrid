/* ============================================================
   PulseGrid — Causal Inference Module
   Granger-style causality testing for economic indicators.
   Tests whether past values of X help predict Y beyond Y's
   own history — implemented from first principles in pure JS.
   ============================================================ */

'use strict';

window.PG = window.PG || {};

/* ============================================================
   GRANGER CAUSALITY TEST (simplified)
   ============================================================
   Tests H0: X does not Granger-cause Y
   Method: Compare residual variance of:
     Restricted model:  Y(t) = a0 + a1*Y(t-1) + ... + aL*Y(t-L) + e
     Unrestricted model: Y(t) = a0 + a1*Y(t-1) + ... + bL*X(t-L) + e
   F-stat = ((RSS_r - RSS_u) / L) / (RSS_u / (n - 2L - 1))
   ============================================================ */

PG.grangerTest = function(xSeries, ySeries, maxLag = 3) {
  // Align by year
  const byYear = {};
  xSeries.forEach(d => { if (d.value !== null && isFinite(d.value)) byYear[d.year] = { x: d.value }; });
  ySeries.forEach(d => {
    if (d.value !== null && isFinite(d.value) && byYear[d.year]) byYear[d.year].y = d.value;
  });

  const aligned = Object.entries(byYear)
    .filter(([, v]) => v.x !== undefined && v.y !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([year, v]) => ({ year: parseInt(year), x: v.x, y: v.y }));

  if (aligned.length < maxLag * 3 + 2) return null; // Need enough observations

  const n = aligned.length;
  const results = [];

  for (let lag = 1; lag <= maxLag; lag++) {
    const effectiveN = n - lag;
    if (effectiveN < lag * 2 + 2) continue;

    // Build matrices for restricted and unrestricted models
    const yVals = aligned.slice(lag).map(d => d.y);

    // Restricted: Y(t) regressed on Y(t-1)...Y(t-lag)
    const Xr = [];
    for (let t = lag; t < n; t++) {
      const row = [1]; // intercept
      for (let l = 1; l <= lag; l++) row.push(aligned[t - l].y);
      Xr.push(row);
    }

    // Unrestricted: Y(t) regressed on Y(t-1)...Y(t-lag), X(t-1)...X(t-lag)
    const Xu = [];
    for (let t = lag; t < n; t++) {
      const row = [1]; // intercept
      for (let l = 1; l <= lag; l++) row.push(aligned[t - l].y);
      for (let l = 1; l <= lag; l++) row.push(aligned[t - l].x);
      Xu.push(row);
    }

    const rssR = computeOLSResiduals(Xr, yVals);
    const rssU = computeOLSResiduals(Xu, yVals);

    if (rssR === null || rssU === null || rssU <= 0) continue;

    const dfNum = lag;
    const dfDen = effectiveN - 2 * lag - 1;
    if (dfDen <= 0) continue;

    const fStat = ((rssR - rssU) / dfNum) / (rssU / dfDen);
    const pValue = fToPValue(fStat, dfNum, dfDen);

    results.push({
      lag,
      fStatistic: Math.round(fStat * 1000) / 1000,
      pValue: Math.round(pValue * 10000) / 10000,
      significant: pValue < 0.05,
      rssRestricted: rssR,
      rssUnrestricted: rssU,
      observations: effectiveN,
    });
  }

  // Pick the best lag (lowest p-value)
  if (results.length === 0) return null;
  const best = results.reduce((a, b) => a.pValue < b.pValue ? a : b);

  return {
    results,
    bestLag: best.lag,
    bestF: best.fStatistic,
    bestP: best.pValue,
    causal: best.significant,
    interpretation: best.significant
      ? `Evidence suggests X Granger-causes Y at lag ${best.lag} (F=${best.fStatistic.toFixed(2)}, p=${best.pValue.toFixed(4)}).`
      : `No significant Granger-causal relationship detected (best p=${best.pValue.toFixed(4)}).`,
  };
};

/* ── OLS via normal equations: β = (X'X)^-1 X'y ─────────── */
function computeOLSResiduals(X, y) {
  const n = X.length;
  const k = X[0].length;
  if (n <= k) return null;

  // X'X
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += X[t][i] * X[t][j];
      XtX[i][j] = s;
      XtX[j][i] = s;
    }
  }

  // X'y
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let t = 0; t < n; t++) Xty[i] += X[t][i] * y[t];
  }

  // Solve via Gaussian elimination
  const beta = solveLinearSystem(XtX, Xty);
  if (!beta) return null;

  // Compute RSS = sum(y - Xβ)²
  let rss = 0;
  for (let t = 0; t < n; t++) {
    let pred = 0;
    for (let j = 0; j < k; j++) pred += X[t][j] * beta[j];
    const residual = y[t] - pred;
    rss += residual * residual;
  }

  return rss;
}

/* ── Gaussian elimination with partial pivoting ──────────── */
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    if (Math.abs(M[col][col]) < 1e-12) return null; // Singular

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  // Back substitution
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

/* ── Approximate F-distribution p-value ──────────────────── */
function fToPValue(f, d1, d2) {
  if (f <= 0 || d1 <= 0 || d2 <= 0) return 1;
  // Approximation using regularised incomplete beta function
  const x = d2 / (d2 + d1 * f);
  return betaIncomplete(d2 / 2, d1 / 2, x);
}

function betaIncomplete(a, b, x) {
  // Lentz's continued fraction for regularised incomplete beta
  if (x < 0 || x > 1) return x < 0 ? 0 : 1;
  if (x === 0 || x === 1) return x;

  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  // Lentz's method
  let f0 = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let result = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + numerator / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    result *= d * c;

    // Odd step
    numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + numerator / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    const delta = d * c;
    result *= delta;

    if (Math.abs(delta - 1) < 1e-8) break;
  }

  return 1 - front * result;
}

function lnGamma(z) {
  // Stirling/Lanczos approximation
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 1.208650973866179e-3, -5.395239384953e-6];
  let x = z, y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/* ============================================================
   MULTI-INDICATOR CAUSAL MATRIX
   ============================================================ */
PG.causalMatrix = function(datasets, maxLag = 3) {
  const k = datasets.length;
  const labels = datasets.map(d => d.label || d.indicator);
  const matrix = Array.from({ length: k }, () => Array.from({ length: k }, () => null));
  const causalPairs = [];

  for (let i = 0; i < k; i++) {
    matrix[i][i] = { causal: false, pValue: 1, fStat: 0 }; // self
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const result = PG.grangerTest(datasets[i].data, datasets[j].data, maxLag);
      if (result) {
        matrix[i][j] = { causal: result.causal, pValue: result.bestP, fStat: result.bestF, lag: result.bestLag };
        if (result.causal) {
          causalPairs.push({
            from: labels[i], to: labels[j],
            fStat: result.bestF, pValue: result.bestP, lag: result.bestLag,
          });
        }
      }
    }
  }

  // Generate insights
  const insights = causalPairs
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, 8)
    .map(p => ({
      text: `${p.from} → ${p.to}: Granger-causal at lag ${p.lag} (F=${p.fStat.toFixed(2)}, p=${p.pValue.toFixed(4)})`,
      color: p.pValue < 0.01 ? '#00D4FF' : p.pValue < 0.05 ? '#A78BFA' : '#F59E0B',
      significant: true,
    }));

  return { labels, matrix, causalPairs, insights };
};

/* ── Render causal matrix ────────────────────────────────── */
PG.renderCausalMatrix = function({ labels, matrix, insights }) {
  const grid = document.getElementById('causal-grid');
  if (!grid) return;

  const n = labels.length;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `100px repeat(${n}, minmax(80px, 1fr))`;

  // Header: "X → Y" label
  const corner = document.createElement('div');
  corner.className = 'causal-cell causal-corner';
  corner.innerHTML = '<span style="font-size:0.6rem;color:var(--white-30)">X→Y</span>';
  grid.appendChild(corner);

  labels.forEach(lbl => {
    const cell = document.createElement('div');
    cell.className = 'causal-cell causal-header';
    cell.textContent = lbl.length > 12 ? lbl.slice(0, 12) + '…' : lbl;
    cell.title = lbl;
    grid.appendChild(cell);
  });

  matrix.forEach((row, i) => {
    // Row label
    const rowLabel = document.createElement('div');
    rowLabel.className = 'causal-cell causal-row-label';
    rowLabel.textContent = labels[i].length > 12 ? labels[i].slice(0, 12) + '…' : labels[i];
    rowLabel.title = labels[i];
    grid.appendChild(rowLabel);

    row.forEach((cell, j) => {
      const el = document.createElement('div');
      el.className = 'causal-cell';

      if (i === j) {
        el.style.background = 'var(--bg-400)';
        el.innerHTML = '<span style="color:var(--white-30)">—</span>';
      } else if (cell === null) {
        el.style.background = 'var(--bg-400)';
        el.innerHTML = '<span style="color:var(--white-30)">n/a</span>';
      } else if (cell.causal) {
        const intensity = Math.min(1, cell.fStat / 10);
        el.style.background = `rgba(0, 212, 255, ${0.1 + intensity * 0.4})`;
        el.innerHTML = `<span class="causal-val causal-sig">F=${cell.fStat.toFixed(1)}</span><span class="causal-p">p=${cell.pValue.toFixed(3)}</span>`;
        el.title = `${labels[i]} Granger-causes ${labels[j]} (lag ${cell.lag})`;
      } else {
        el.style.background = 'var(--bg-300)';
        el.innerHTML = `<span class="causal-val">F=${(cell.fStat || 0).toFixed(1)}</span><span class="causal-p" style="color:var(--white-30)">ns</span>`;
        el.title = `No significant causal link (p=${(cell.pValue || 1).toFixed(3)})`;
      }

      grid.appendChild(el);
    });
  });

  // Render insights
  const insightList = document.getElementById('causal-insights');
  if (insightList) {
    insightList.innerHTML = insights.length
      ? insights.map(ins => `
        <li class="insight-item">
          <span class="insight-dot" style="background:${ins.color}"></span>
          <span>${ins.text}</span>
        </li>`).join('')
      : '<li class="insight-item"><span class="insight-dot" style="background:#4B5563"></span><span>No significant causal relationships detected. Try different indicators or a longer time range.</span></li>';
  }
};

PG.log && PG.log('Causal Inference Engine loaded', 'success');
