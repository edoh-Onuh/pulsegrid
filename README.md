<div align="center">

# 🌐 PulseGrid

**A Zero-Dependency Data Science Platform in the Browser**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://pulsegrid-app.netlify.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![JavaScript](https://img.shields.io/badge/vanilla-JS%20ES2023-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![World Bank API](https://img.shields.io/badge/data-World%20Bank%20API-0071bc?style=for-the-badge)](https://data.worldbank.org)

*Real-time macroeconomic analytics, AI-powered narrative intelligence, causal inference, and recession prediction — all running client-side with zero npm dependencies.*

[**Live Demo**](https://pulsegrid-app.netlify.app) · [**Blog Post**](docs/blog.md) · [**Contributing**](CONTRIBUTING.md)

</div>

---

## ⚡ Why PulseGrid?

Most data science tools require Python backends, cloud compute, or heavy frameworks. **PulseGrid proves that serious analytics can run entirely in the browser** — with hand-rolled statistical engines, real-time data pipelines, and AI-powered insights, all in vanilla JavaScript.

| Feature | Traditional Stack | PulseGrid |
|---------|------------------|-----------|
| Runtime | Python + pandas + scikit-learn | Vanilla JS ES2023 |
| Data Pipeline | Airflow / Prefect | IndexedDB + Service Worker cache |
| ML Models | TensorFlow / statsmodels | Hand-rolled Holt-Winters, Granger causality |
| AI Reports | OpenAI API ($$$) | Rule-based NLG engine (zero cost) |
| Deployment | Docker + K8s | Static HTML on CDN |
| Dependencies | 200+ npm packages | 1 CDN (Chart.js) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PulseGrid Frontend                    │
├─────────────┬──────────────┬──────────────┬─────────────┤
│  pipeline.js│   engine.js  │   charts.js  │   app.js    │
│  Data Layer │  Stats Engine│  Viz Engine   │  Controller │
├─────────────┼──────────────┼──────────────┼─────────────┤
│ narrative.js│  causal.js   │ recession.js │  embed.js   │
│  NLG Engine │  Granger Test│  CLI Engine   │  Widgets    │
├─────────────┴──────────────┴──────────────┴─────────────┤
│              World Bank API  ←  IndexedDB Cache (6h TTL) │
└─────────────────────────────────────────────────────────┘
```

### Optional Backend (server/)
```
Express.js API → Scheduled cron pipelines → In-memory cache
Endpoints: /api/wb/:country/:indicator, /api/recession/:country, /api/analyses
```

---

## ✨ Features

### 📊 Core Analytics
- **Interactive Dashboard** — 15 macroeconomic indicators across 200+ countries
- **Holt-Winters Forecasting** — Double exponential smoothing with configurable α/β
- **Pearson Correlation Matrix** — Multi-indicator cross-correlation heatmaps
- **Anomaly Detection** — Z-score & IQR-based outlier identification
- **Multi-Country Comparison** — Side-by-side analysis with normalisation

### 🧠 AI Insights Engine
- **Narrative Intelligence** — Rule-based NLG engine generates multi-section analytical reports with executive summaries, structural break detection, trend phase analysis, and forward-looking outlook
- **Causal Inference** — Granger causality testing from first principles: OLS via normal equations, Gaussian elimination with partial pivoting, F-distribution p-values via regularised incomplete beta function
- **Recession Predictor** — Composite Leading Indicator (CLI) with 6 weighted signals, real-time gauge visualisation, timeline charts, and 12-month projections

### 🔧 Engineering
- **Zero-dependency frontend** — Only Chart.js via CDN; all statistics hand-rolled
- **IndexedDB cache** — 6-hour TTL with automatic eviction, offline resilience
- **Embeddable widgets** — Generate iframe/script embed codes for any chart
- **Data pipeline** — Retry with exponential backoff, automatic interpolation, normalisation
- **Real-time logging** — Built-in developer console with timestamped pipeline events

---

## 🚀 Quick Start

### Frontend Only (Recommended)
```bash
# Clone
git clone https://github.com/edoh-Onuh/pulsegrid.git
cd pulsegrid

# Serve (any static server works)
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080` — that's it. No build step, no npm install.

### With Backend API
```bash
cd server
npm install
npm start
# API running on http://localhost:3001
```

---

## 📁 Project Structure

```
pulsegrid/
├── index.html          # Single-page application (800+ lines)
├── embed.html          # Standalone embeddable widget
├── css/
│   └── styles.css      # Full design system (1400+ lines)
├── js/
│   ├── pipeline.js     # Data fetching, caching, normalisation
│   ├── engine.js       # Statistical computations
│   ├── charts.js       # Chart.js wrappers & visualisations
│   ├── app.js          # Main controller & UI logic
│   ├── narrative.js    # AI narrative report generator
│   ├── causal.js       # Granger causality engine
│   ├── recession.js    # Recession prediction engine
│   └── embed.js        # Embeddable widget system
├── server/             # Optional Node.js backend
│   ├── index.js        # Express API server
│   ├── pipeline.js     # Server-side data pipeline
│   ├── cache.js        # In-memory cache with TTL
│   └── package.json
├── docs/
│   └── blog.md         # Technical blog post
├── CONTRIBUTING.md     # Contribution guidelines
├── LICENSE             # MIT License
└── README.md           # You are here
```

---

## 🧪 Technical Deep Dives

### Granger Causality (causal.js)
Unlike libraries that call `statsmodels.grangercausalitytests()`, PulseGrid implements Granger causality **from mathematical foundations**:

1. **OLS Regression** via normal equations (X'X)⁻¹X'y
2. **Matrix inversion** via Gaussian elimination with partial pivoting
3. **F-statistic** computed from restricted/unrestricted model RSS
4. **P-value** via regularised incomplete beta function using Lentz's continued fraction algorithm

### Narrative Intelligence (narrative.js)
A rule-based Natural Language Generation engine that produces multi-section analytical reports:

- **Structural break detection** — Identifies regime changes using rolling standard deviation
- **Trend phase analysis** — Classifies periods into growth, decline, stability, and volatility phases
- **Global event matching** — Correlates data patterns with known events (COVID-19, GFC, etc.)
- **Regional context** — Enriches narratives with country-specific economic intelligence

### Recession Predictor (recession.js)
Composite Leading Indicator (CLI) engine combining 6 macroeconomic signals:

| Indicator | Weight | Signal Function |
|-----------|--------|----------------|
| GDP Growth | 30% | Negative growth detection |
| Unemployment | 20% | Above-threshold assessment |
| Inflation | 15% | Deviation from 2% target |
| Exports/GDP | 15% | Year-over-year decline |
| FDI/GDP | 10% | Below historical mean |
| Govt Debt/GDP | 10% | Above 80% threshold |

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority areas:**
- Additional statistical methods (ARIMA, VAR, cointegration tests)
- More data sources (IMF, OECD, UN)
- Accessibility improvements
- Internationalisation (i18n)
- Mobile UX refinements

---

## 📝 License

MIT © [Edoh Onuh](https://edon-tech.netlify.app)

---

<div align="center">

**Built with curiosity and vanilla JavaScript.**

*If you find PulseGrid useful, consider giving it a ⭐*

</div>
