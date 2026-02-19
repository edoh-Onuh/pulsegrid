# Contributing to PulseGrid

Thank you for your interest in contributing to PulseGrid! This document provides guidelines and information for contributors.

## 🌟 Philosophy

PulseGrid is deliberately **zero-dependency** (except Chart.js via CDN). Before proposing a new npm package, consider whether the feature can be implemented from first principles. This is a core differentiator of the project.

## 🚀 Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pulsegrid.git
   cd pulsegrid
   ```
3. **Serve** locally:
   ```bash
   npx serve .
   # or python -m http.server 8080
   ```
4. Create a **feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📐 Code Style

### JavaScript
- **ES2023+** features are welcome (optional chaining, nullish coalescing, etc.)
- All statistical/ML code should be **implemented from scratch** — no external libraries
- Use the `PG` namespace for all public functions: `PG.myFunction = function() {...}`
- Use `'use strict';` in all modules
- Prefer `const` over `let`, never use `var`
- Document complex algorithms with inline comments explaining the math

### CSS
- Use CSS custom properties (variables) defined in `:root`
- Follow the existing BEM-like naming convention
- Ensure responsive design works at breakpoints: 1100px, 860px, 640px, 480px
- Include `prefers-reduced-motion` support for animations

### HTML
- Semantic HTML5 elements
- ARIA labels for interactive elements
- Section numbering convention: `<!-- 01 ─── SECTION_NAME ─── -->`

## 📁 File Structure

| File | Purpose |
|------|---------|
| `js/pipeline.js` | Data fetching, caching (IndexedDB), normalisation |
| `js/engine.js` | Statistical computations (stats, forecasting, correlation) |
| `js/charts.js` | Chart.js wrappers and visualisation logic |
| `js/app.js` | Main controller, event handlers, UI state management |
| `js/narrative.js` | AI narrative report generation (NLG engine) |
| `js/causal.js` | Granger causality testing |
| `js/recession.js` | Recession prediction engine |
| `js/embed.js` | Embeddable widget system |
| `css/styles.css` | Complete design system |

## 🧪 Testing

PulseGrid currently uses manual testing. When contributing:

1. Test across Chrome, Firefox, Safari, and Edge
2. Verify responsive layout at all breakpoints
3. Test with slow network throttling (3G) to verify cache behaviour
4. Open browser DevTools console — no errors should appear
5. Test with at least 3 different countries and indicators

### Adding Automated Tests
If you'd like to add automated testing, we welcome:
- Unit tests for statistical functions (engine.js, causal.js)
- Integration tests for data pipeline (pipeline.js)
- E2E tests using Playwright or Cypress

## 🔀 Pull Request Process

1. **Create an issue** first to discuss the change (for non-trivial features)
2. **One PR per feature** — keep changes focused
3. **Update documentation** — if you add a feature, update README.md
4. **Test thoroughly** — see testing guidelines above
5. **Write a clear PR description** explaining:
   - What the change does
   - Why it's needed
   - How you tested it
   - Screenshots/recordings for UI changes

## 🎯 Priority Contribution Areas

### High Priority
- **ARIMA forecasting** — Implement in `engine.js` from first principles
- **VAR models** — Vector autoregression for multi-indicator forecasting
- **Cointegration tests** — Engle-Granger or Johansen test implementation
- **Accessibility audit** — Screen reader support, keyboard navigation
- **PWA support** — Service worker for offline functionality

### Medium Priority
- **Additional data sources** — IMF, OECD, UN APIs
- **More chart types** — Box plots, violin plots, area charts
- **Data export** — PDF report generation, Excel export
- **i18n** — Internationalisation support
- **Dark/light theme toggle**

### Nice to Have
- **WebWorker offloading** — Move heavy computations off main thread
- **WebAssembly** — Port statistical engines to Rust/WASM for performance
- **Collaborative features** — Shareable analysis links
- **Plugin system** — Allow custom indicator definitions

## 📜 Code of Conduct

- Be respectful and constructive
- Welcome newcomers — help them understand the codebase
- Focus on the technical merits of contributions
- Assume good intentions

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open an issue or reach out to [@edoh-Onuh](https://github.com/edoh-Onuh).
