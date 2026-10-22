import { defineConfig, devices } from '@playwright/test';
import { PUBLIC_ORIGIN } from './src/testutil/e2e-origin';

const PORT = 4173;

// Viewports from specs/stack.md F6 (mobile < 860px, desktop >= 860px) and
// browsers from X10. Every viewport runs on Chromium; WebKit covers iOS
// Safari and desktop Safari; Firefox covers one desktop size.
const mobile = [
	{ name: 'mobile-390', viewport: { width: 390, height: 844 } },
	{ name: 'mobile-360', viewport: { width: 360, height: 800 } },
	{ name: 'mobile-430', viewport: { width: 430, height: 932 } }
];
const desktop = [
	{ name: 'desktop-860', viewport: { width: 860, height: 800 } },
	{ name: 'desktop-1280', viewport: { width: 1280, height: 800 } },
	{ name: 'desktop-1440', viewport: { width: 1440, height: 900 } }
];

// specs/stack.md F4 "Tiered E2E matrix": the core projects run every test;
// the other widths only run @layout tests and the other engines only
// @cross-browser ones. E2E_MATRIX=full (nightly, on demand) runs everything
// everywhere.
const CORE_PROJECTS = new Set(['chromium-mobile-390', 'chromium-desktop-1280']);
const LAYOUT_TAG = /@layout/;
const CROSS_BROWSER_TAG = /@cross-browser/;
const fullMatrix = process.env.E2E_MATRIX === 'full';

function tier(name: string, crossBrowser: boolean): { grep?: RegExp } {
	if (fullMatrix || CORE_PROJECTS.has(name)) return {};
	return { grep: crossBrowser ? CROSS_BROWSER_TAG : LAYOUT_TAG };
}

export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
	webServer: {
		// The production server (adapter-node), not the Vite preview.
		command: 'pnpm build && node build',
		url: `http://127.0.0.1:${PORT}/healthz`,
		env: {
			PORT: String(PORT),
			HOST: '127.0.0.1',
			// Canonical and hreflang URLs are built from this, not the request host.
			PUBLIC_ORIGIN,
			// The vendored content bundle: E2E runs (and CI) need no backend.
			DATA_SOURCE: 'mock'
		},
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	},
	projects: [
		...mobile.map((p) => ({
			name: `chromium-${p.name}`,
			...tier(`chromium-${p.name}`, false),
			use: { ...devices['Desktop Chrome'], viewport: p.viewport, isMobile: true, hasTouch: true }
		})),
		...desktop.map((p) => ({
			name: `chromium-${p.name}`,
			...tier(`chromium-${p.name}`, false),
			use: { ...devices['Desktop Chrome'], viewport: p.viewport }
		})),
		{ name: 'webkit-iphone', ...tier('webkit-iphone', true), use: { ...devices['iPhone 13'] } },
		{
			name: 'webkit-desktop-1440',
			...tier('webkit-desktop-1440', true),
			use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'firefox-desktop-1280',
			...tier('firefox-desktop-1280', true),
			use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } }
		}
	]
});
