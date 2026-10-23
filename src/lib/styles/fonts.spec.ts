import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// FE-8 PR 3 (stage FE-8 -> Performance: "use font-display: swap with the
// self-hosted subsets (D-FE0-1)"): every @font-face in fonts.css swaps, so
// text shows in the fallback face while a file loads, and every face is a
// self-hosted woff2 (fontsource), never a remote URL. Which two faces are
// preloaded is pinned in foundation.e2e.ts.

const FONTS_CSS = 'src/lib/styles/fonts.css';

function fontFaces(): string[] {
	const css = readFileSync(FONTS_CSS, 'utf8');
	return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
}

const family = (face: string) => /font-family:\s*([^;]+);/.exec(face)?.[1].trim() ?? '(none)';

describe('fonts.css', () => {
	it('declares @font-face rules', () => {
		expect(fontFaces().length, 'got no @font-face in fonts.css').toBeGreaterThan(0);
	});

	it('every face uses font-display: swap', () => {
		const notSwap = fontFaces().filter((face) => !/font-display:\s*swap\s*;/.test(face));
		expect(notSwap.map(family), 'got faces without font-display: swap').toEqual([]);
	});

	it('every face is one self-hosted woff2 file', () => {
		for (const face of fontFaces()) {
			const urls = [...face.matchAll(/url\('([^']+)'\)\s*format\('([^']+)'\)/g)];
			expect(urls.length, `got ${urls.length} src URLs for ${family(face)}, want 1`).toBe(1);
			const [, url, format] = urls[0];
			expect(url, `got ${url}, want a @fontsource woff2`).toMatch(/^@fontsource\/.+\.woff2$/);
			expect(format, `got format ${format}, want woff2`).toBe('woff2');
		}
	});
});
