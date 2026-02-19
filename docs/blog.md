# Building a Zero-Dependency Data Science Platform in the Browser

*How I implemented Granger causality, recession prediction, and AI narrative reports in vanilla JavaScript — without a single npm install.*

---

## The Problem

Every data science portfolio project looks the same: a Jupyter notebook calling `pandas.read_csv()`, a Streamlit dashboard with `st.line_chart()`, maybe a Flask API wrapping `scikit-learn`. The tools are powerful, but they mask the mathematics. When every candidate uses the same abstraction layers, how do you demonstrate genuine understanding?

I wanted to build something different — a production-grade data science platform that:

1. **Implements algorithms from mathematical foundations**, not library calls
2. **Runs entirely in the browser** with no backend, no build step, no dependencies
3. **Connects to live data** from the World Bank API (200+ countries, 15 indicators)
4. **Produces AI-powered analytical reports** without calling OpenAI

The result is [PulseGrid](https://pulsegrid-app.netlify.app).

---

## Architecture: Why No Dependencies?

The conventional wisdom is that you *need* pandas for data manipulation, statsmodels for statistical testing, and React for the UI. But these abstractions come at a cost:

- **pandas** hides the computational complexity of vectorised operations
- **statsmodels** hides the linear algebra behind Granger causality
- **React** adds 40KB+ of runtime for what could be 10 lines of DOM manipulation

PulseGrid uses **vanilla JavaScript ES2023** with a single CDN import (Chart.js for rendering). Everything else — the statistics, the forecasting, the causality testing, the narrative generation — is implemented from scratch.

```
8 JavaScript modules  │  ~120KB total  │  1 CDN dependency  │  0 build tools
```

### The Module System

```
pipeline.js  →  Data fetching, IndexedDB caching, retry logic
engine.js    →  Stats, Holt-Winters forecasting, correlation, anomaly detection
charts.js    →  Chart.js wrappers, heatmaps, sparklines
narrative.js →  Rule-based NLG engine
causal.js    →  Granger causality from first principles
recession.js →  Composite Leading Indicator engine
embed.js     →  Embeddable widget system
app.js       →  Controller binding everything together
```

---

## Deep Dive: Granger Causality from Scratch

The most technically challenging feature is the **Granger causality engine**. Most implementations call `statsmodels.grangercausalitytests()` and present the p-values. I implemented it from the mathematical foundations:

### Step 1: OLS via Normal Equations

For a regression $y = X\beta + \epsilon$, the least-squares solution is:

$$\hat{\beta} = (X^T X)^{-1} X^T y$$

I construct the design matrices for restricted (AR-only) and unrestricted (AR + lagged X) models, then solve via normal equations.

### Step 2: Matrix Inversion via Gaussian Elimination

Rather than importing a linear algebra library, I implemented Gaussian elimination with **partial pivoting** to solve the $(X^T X)^{-1}$ system. Partial pivoting prevents numerical instability when diagonal elements are near-zero.

### Step 3: F-Statistic

The Granger test compares the fit of two nested models:

$$F = \frac{(RSS_r - RSS_u) / q}{RSS_u / (n - k)}$$

where $RSS_r$ and $RSS_u$ are the residual sums of squares for restricted and unrestricted models.

### Step 4: P-Value via Regularised Incomplete Beta

The F-distribution CDF requires the regularised incomplete beta function $I_x(a,b)$. I implemented this using **Lentz's continued fraction algorithm**, which converges rapidly for the parameter ranges we encounter.

The entire implementation is ~300 lines of JavaScript. No imports.

---

## Deep Dive: AI Narrative Reports Without AI APIs

The narrative engine generates multi-section analytical reports that read like they were written by an economist. The secret: **rule-based Natural Language Generation (NLG)** with a rich knowledge base.

### The Knowledge Base

```javascript
const ECON_CONTEXT = {
  'NY.GDP.MKTP.CD': {
    name: 'GDP',
    drivers: ['consumer spending', 'government expenditure', 'net exports', 'investment'],
    declineReasons: ['reduced consumer confidence', 'trade disruptions', 'fiscal austerity'],
    growthReasons: ['export expansion', 'foreign investment inflows', 'fiscal stimulus'],
  },
  // ... 6 indicators with rich context
};
```

### Structural Break Detection

The engine identifies regime changes by computing a rolling standard deviation and flagging points where the deviation exceeds 2x the series-wide standard deviation. These breaks are then matched against a database of global events (COVID-19, 2008 GFC, etc.) to provide causal context.

### Trend Phase Analysis

Time series are decomposed into phases:
- **Growth** — sustained positive change
- **Decline** — sustained negative change
- **Volatility** — high variance without clear direction
- **Stability** — low variance around a mean

Each phase generates contextually appropriate narrative text.

---

## Deep Dive: The Recession Predictor

The recession engine implements a **Composite Leading Indicator (CLI)** — the same methodology used by the OECD. Six macroeconomic signals are weighted and combined:

| Signal | Weight | Threshold Logic |
|--------|--------|----------------|
| GDP Growth < 0 | 30% | Negative growth = recessionary signal |
| Unemployment > 8% | 20% | Above NAIRU proxy |
| Inflation deviating from 2% | 15% | Phillips curve stress |
| Exports/GDP declining | 15% | Trade deterioration |
| FDI/GDP below mean | 10% | Capital flight indicator |
| Govt Debt > 80% of GDP | 10% | Debt sustainability threshold |

The composite probability is visualised as a gauge with colour-coded risk levels, and a timeline chart shows how recession risk has evolved over the past 20 years.

---

## The Data Pipeline

### Caching Strategy

```
World Bank API → 3x retry with exponential backoff → IndexedDB (6h TTL)
```

The browser's IndexedDB is used as a proper data store with timestamped entries and automatic eviction. This means:
- **First load**: ~2-3 seconds (API calls)
- **Subsequent loads**: ~50ms (cache hit)
- **Offline**: Full functionality with cached data

### Normalisation & Interpolation

Raw World Bank data often has gaps. The pipeline applies:
1. **Linear interpolation** for missing years
2. **Min-max normalisation** for cross-indicator comparison
3. **Automatic unit detection** (billions, millions, percentages)

---

## Lessons Learned

### 1. Implementing algorithms from scratch deepens understanding
Writing Gaussian elimination by hand taught me more about numerical stability than any library ever could. When you *are* the library, you understand every edge case.

### 2. The browser is more powerful than we think
IndexedDB, Canvas API, ES2023 features, and modern CSS can replace most of what we use Python backends for in data science.

### 3. Zero-dependency is a feature, not a constraint
Every dependency is a liability — security vulnerabilities, breaking changes, bundle size. PulseGrid's total JavaScript is ~120KB. A typical React+D3 dashboard starts at 500KB.

### 4. The "AI" in AI reports doesn't require neural networks
Rule-based NLG with a rich knowledge base produces remarkably coherent analytical text. Not every AI feature needs an API key.

---

## What's Next

- **ARIMA & VAR models** — Time series analysis from first principles
- **Cointegration testing** — Engle-Granger implementation
- **WebAssembly** — Port statistical engines to Rust for 10x performance
- **Plugin system** — Allow users to define custom indicators

---

## Try It

🌐 **Live Demo**: [pulsegrid-app.netlify.app](https://pulsegrid-app.netlify.app)
📂 **Source Code**: [github.com/edoh-Onuh/pulsegrid](https://github.com/edoh-Onuh/pulsegrid)

*PulseGrid is MIT licensed. Contributions welcome.*
