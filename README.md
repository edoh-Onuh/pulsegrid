<div align="center">

# PulseGrid

**Browser-Native Economic Intelligence Engine**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://pulsegrid-app.netlify.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![JavaScript](https://img.shields.io/badge/vanilla-JS%20ES2023-yellow?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![World Bank API](https://img.shields.io/badge/data-World%20Bank%20API-0071bc?style=for-the-badge)](https://data.worldbank.org)

*Real-time macroeconomic analytics, AI-powered narrative intelligence, Granger causality inference, and recession prediction — all running client-side with zero npm dependencies.*

[**Live Demo**](https://pulsegrid-app.netlify.app) · [**Blog Post**](docs/blog.md) · [**Contributing**](CONTRIBUTING.md)

</div>

---

## Why PulseGrid?

Most data science tools require Python backends, cloud compute, or heavy frameworks. **PulseGrid proves that serious analytics can run entirely in the browser** — with hand-rolled statistical engines, a real-time ETL pipeline, and AI-generated insights, all in vanilla JavaScript.

| Concern | Traditional Stack | PulseGrid |
|---------|------------------|-----------|
| Runtime | Python + pandas + scikit-learn | Vanilla JS ES2023 |
| Data Pipeline | Airflow / Prefect | IndexedDB + 6 h TTL cache |
| ML Models | TensorFlow / statsmodels | Hand-rolled Holt-Winters, Granger causality |
| AI Reports | OpenAI API ($$$) | Rule-based NLG engine (zero cost) |
| Deployment | Docker + K8s | Static HTML on CDN |
| Dependencies | 200+ npm packages | 1 CDN script (Chart.js) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PulseGrid Frontend                        │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│ pipeline.js │  engine.js   │  charts.js   │    app.js       │
│ Data Layer  │ Stats Engine │  Viz Engine  │   Controller    │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│narrative.js │  causal.js   │recession.js  │   embed.js      │
│  NLG Engine │Granger Test  │  CLI Engine  │  Widget System  │
├─────────────┴──────────────┴──────────────┴─────────────────┤
│         World Bank API  ←→  IndexedDB Cache (6 h TTL)       │
└─────────────────────────────────────────────────────────────┘
```

### Optional Backend (`server/`)
```
Express.js → node-cron scheduled pipelines → in-memory cache
GET /api/wb/:country/:indicator   — proxied World Bank data
GET /api/recession/:country       — pre-computed CLI scores
GET /api/analyses                 — cached narrative reports
```

---

## Features

### Live Dashboard
- **217 countries**, **15 macroeconomic indicators**, **60+ years** of World Bank data
- Country + indicator + year-range selectors with real-time chart updates
- Auto-loads with sensible defaults on every visit
- Live API status indicator in the nav bar
- Offline banner + cached-data fallback when the network drops

**Indicators tracked:**

| Code | Name |
|------|------|
| `NY.GDP.MKTP.CD` | GDP (Current USD) |
| `NY.GDP.MKTP.KD.ZG` | GDP Growth (%) |
| `NY.GDP.PCAP.CD` | GDP per Capita (USD) |
| `FP.CPI.TOTL.ZG` | Inflation Rate (%) |
| `SL.UEM.TOTL.ZS` | Unemployment (%) |
| `NE.EXP.GNFS.ZS` | Exports (% of GDP) |
| `NE.IMP.GNFS.ZS` | Imports (% of GDP) |
| `BX.KLT.DINV.WD.GD.ZS` | FDI Net Inflows (% GDP) |
| `GC.DOD.TOTL.GD.ZS` | Government Debt (% GDP) |
| `SP.POP.TOTL` | Total Population |
| `SE.ADT.LITR.ZS` | Adult Literacy Rate (%) |
| `SH.XPD.CHEX.GD.ZS` | Health Expenditure (% GDP) |
| `EN.ATM.CO2E.PC` | CO₂ Emissions (t per capita) |
| `EG.USE.ELEC.KH.PC` | Electric Power Consumption |
| `IT.NET.USER.ZS` | Internet Users (%) |

### Forecast
- **Holt-Winters double exponential smoothing** with configurable α / β sliders
- In-chart confidence bands and projected values
- Switchable chart types (line / bar)

### Correlation
- **Pearson correlation matrix** across any subset of the 15 indicators
- Colour-coded heatmap rendered via Chart.js

### Anomaly Detection
- **Z-score** and **IQR** outlier identification on any time series
- Anomalous data points highlighted directly on the chart

### Multi-Country Comparison
- Side-by-side overlay of up to N countries on a single chart
- Toggle normalisation to compare relative trends regardless of scale

### AI Narrative Insights (`narrative.js`)
A rule-based Natural Language Generation (NLG) engine — no external API required:

- **Economic knowledge base** — per-indicator drivers, decline / growth reasons
- **Global events database** — automatically correlates data anomalies withknown events (COVID-19, GFC 2008, 2014 oil crash, etc.)
- **Structural break detection** — rolling standard deviation identifies regime changes
- **Trend phase classification** — growth, decline, stability, and volatility phases
- **Regional context enrichment** — country-specific narrative framing
- Outputs a multi-section analyst-style report: executive summary, trend analysis, structural breaks, outlook

### Granger Causality (`causal.js`)
Full implementation from first principles — no library calls:

1. **OLS regression** via normal equations $(X^TX)^{-1}X^Ty$
2. **Matrix inversion** via Gaussian elimination with partial pivoting
3. **F-statistic** from restricted vs unrestricted model RSS
4. **P-value** via regularised incomplete beta function (Lentz continued-fraction algorithm)
5. Tests lags 1–3; reports F-stat, p-value, and significance per lag

### Recession Predictor (`recession.js`)
Composite Leading Indicator (CLI) combining 6 weighted macroeconomic signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| GDP Growth | 30 % | Contractionary if < 0 % |
| Unemployment delta | 20 % | Rising sharply = stress |
| Inflation | 15 % | Extreme deviation from 2 % target |
| Exports (% GDP) | 15 % | Year-over-year decline |
| FDI Inflows | 10 % | Falling inflows signal capital flight |
| Government Debt | 10 % | Above 80 % GDP threshold |

- Real-time gauge visualisation (0–100 % risk score)
- 12-month recession probability projection chart
- Timeline of historical CLI scores

### Data Pipeline Section
- Built-in developer console with timestamped, colour-coded pipeline logs
- Live metrics: API requests fired, null values imputed, models run, charts rendered
- Session summary panel updated in real-time

### Embeddable Widgets (`embed.js` / `embed.html`)
- Generate `<iframe>` or `<script>` embed codes for any chart
- Standalone `embed.html` page for iframe embedding
- Configurable country, indicator, and date range via URL params

---

## Quick Start

### Frontend Only (Recommended)
```bash
git clone https://github.com/edoh-Onuh/pulsegrid.git
cd pulsegrid

# Any static file server works — no build step, no npm install
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080`. Done.

### With the Optional Backend API
```bash
cd server
npm install
npm start          # Express API on http://localhost:3001
```

The frontend auto-detects the local API and routes requests through it instead of calling World Bank directly.

---

## Project Structure

```
pulsegrid/
├── index.html               # Single-page app (~960 lines)
├── embed.html               # Standalone embeddable widget page
├── favicon.svg
├── css/
│   └── styles.css           # Full design system (~1 400 lines)
├── js/
│   ├── pipeline.js          # World Bank API client, IndexedDB cache, ETL
│   ├── engine.js            # Statistical engine (Holt-Winters, correlation, anomaly)
│   ├── charts.js            # Chart.js wrappers & all visualisations
│   ├── app.js               # Main UI controller (~1 000 lines)
│   ├── narrative.js         # Rule-based NLG narrative engine (~500 lines)
│   ├── causal.js            # Granger causality from first principles (~340 lines)
│   ├── recession.js         # Composite Leading Indicator engine (~336 lines)
│   └── embed.js             # Embeddable widget system
├── server/                  # Optional Node.js backend
│   ├── index.js             # Express API server
│   ├── pipeline.js          # Server-side data pipeline
│   ├── cache.js             # In-memory cache with TTL
│   └── package.json         # express, cors, node-cron, compression
├── docs/
│   └── blog.md              # Technical write-up
├── CONTRIBUTING.md
├── LICENSE                  # MIT
└── README.md
```

---

## Engineering Notes

### IndexedDB Cache
- 6-hour TTL on all World Bank responses
- Automatic expiry eviction on read
- Fully offline-capable: stale data served with a UI banner rather than a hard error

### Data Pipeline
- Exponential-backoff retry (3 attempts, 1.2 s base delay) on all API calls
- Automatic linear interpolation for sparse / missing data points
- Min-max normalisation toggle for cross-country comparison

### Zero-Dependency Frontend
The only external resource loaded is Chart.js via CDN. Every statistical algorithm — Holt-Winters smoothing, Pearson correlation, IQR/Z-score anomaly detection, OLS regression, Granger F-test, and the NLG engine — is implemented from scratch in vanilla JS ES2023.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority areas:**
- Additional statistical methods (ARIMA, VAR, cointegration tests)
- More data sources (IMF, OECD, UN)
- Accessibility improvements
- Internationalisation (i18n)
- Mobile UX refinements

---

## License

MIT © [Edoh Onuh](https://edon-tech.netlify.app)

---

<div align="center">

**Built with curiosity and vanilla JavaScript.**

*If PulseGrid is useful to you, consider giving it a ⭐*

</div>
