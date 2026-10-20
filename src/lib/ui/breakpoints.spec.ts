import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-3 / F6: one breakpoint, 860px ("Desktop (≥ 860px)"; "Below 860px a
// separate mobile layout applies"). Script code reads it from one module,
// src/lib/ui/breakpoints.ts, never a copied number; `desktopQuery` is the
// media query string built from it (for MediaQuery / matchMedia).

const MODULE = 'src/lib/ui/breakpoints.ts';

describe('breakpoints', () => {
	it('exports the desktop breakpoint as 860 (px)', async () => {
		expect(await loadExport<number>(MODULE, 'DESKTOP_MIN_WIDTH_PX')).toBe(860);
	});

	it('exports desktopQuery as "(min-width: 860px)"', async () => {
		expect(await loadExport<string>(MODULE, 'desktopQuery')).toBe('(min-width: 860px)');
	});
});
