import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { loadUiExport } from '../../testutil/ui';

// FE-3 acceptance: "At 860px the desktop layout applies, and at 859px the
// mobile one does." desktopQuery is what the app branches on.

const DEFAULT_VIEWPORT = { width: 414, height: 896 };

afterEach(() => page.viewport(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height));

describe('desktopQuery in the browser', () => {
	const widths = [
		{ width: 859, desktop: false },
		{ width: 860, desktop: true },
		{ width: 1440, desktop: true },
		{ width: 360, desktop: false }
	];
	for (const { width, desktop } of widths) {
		it(`${desktop ? 'matches' : 'does not match'} at ${width}px wide`, async () => {
			const desktopQuery = await loadUiExport<string>('breakpoints.ts', 'desktopQuery');
			await page.viewport(width, 800);
			expect(matchMedia(desktopQuery).matches).toBe(desktop);
		});
	}
});
