// The D-FE8-2 performance budgets (owner decision, 2026-10-22; stack.md F4
// "Performance budgets"). The one place they are written: the gzip JS spec
// (src/routes/perf-js-budget.e2e.ts) and the Lighthouse config
// (lighthouserc.js) both read them. Tighten freely; never loosen them to
// make a run pass.
//
// Plain erasable TypeScript with no imports, so lighthouserc.js can load
// it under Node's type stripping.

// ≤ 90 KB of gzip JavaScript on initial load (90 × 1024).
export const JS_GZIP_BUDGET_BYTES = 92_160;

// Largest Contentful Paint < 2.5 s and Cumulative Layout Shift < 0.1, on
// Lighthouse's mobile (Moto G Power) and desktop presets.
export const LCP_BUDGET_MS = 2500;
export const CLS_BUDGET = 0.1;

// The budgeted pages, without the locale prefix: home, Variations, Recipe.
export const BUDGETED_PATHS = ['/', '/dishes/tortilla', '/dishes/tortilla/gal'];

// Lighthouse runs each page this many times and asserts the median.
export const LIGHTHOUSE_RUNS = 3;
