import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repoFile } from '../../testutil/load-export';

// FE-3 layout tokens, in src/lib/styles/layout.css (D-FE3-1 outcome; the
// design tokens.css stays a byte mirror, so these live beside it). One
// declaration each, in :root:
//
// --sheet-height          min(76dvh, 640px)      D-FE3-1: 640/844 = 75.8%
// --sheet-peek            min(310px, var(--sheet-height))   content-driven peek
// --sheet-offset-peek     calc(var(--sheet-height) - var(--sheet-peek))
// --sheet-offset-hidden   calc(100% + 40px)      "680 = 640 + 40 clears the shadow"
// --content-max-width     1440px                 "Content max-width 1440px, centred"
// --desktop-side-padding  clamp(24px, 2.8vw, 40px)   desktop README: "Side padding
// --desktop-gap           clamp(28px, 3.4vw, 48px)    and gaps are fluid"
// --hit-min               44px                   "All tap targets ≥ 44px tall"
// --shadow-card-hover     0 10px 26px rgba(43,30,22,.1)   desktop README -> Popular:
//                                                "hover lifts 2px with shadow ..."
// --radius-button-compact 13px                   prototype "Show results" (compact)
// --bg-top-bar            rgba(246,239,227,.94)  StickyTopBar background
// --blur-top-bar          blur(8px)              StickyTopBar backdrop-filter
// --bg-back-button        rgba(43,30,22,.07)     StickyTopBar back circle
// --bg-back-button-hover  rgba(43,30,22,.13)     its hover (prototype)
// --bg-back-pill-hover    rgba(43,30,22,.11)     desktop BackPill hover (prototype)
// --focus-ring            (any colour)           the shared :focus-visible ring
//
// The values are compared after normalising formatting (whitespace, a
// leading 0 before a decimal point), since Prettier formats this file.

const LAYOUT_CSS = 'src/lib/styles/layout.css';

const TOKENS: Record<string, string> = {
	'--sheet-height': 'min(76dvh, 640px)',
	'--sheet-peek': 'min(310px, var(--sheet-height))',
	'--sheet-offset-peek': 'calc(var(--sheet-height) - var(--sheet-peek))',
	'--sheet-offset-hidden': 'calc(100% + 40px)',
	'--content-max-width': '1440px',
	'--desktop-side-padding': 'clamp(24px, 2.8vw, 40px)',
	'--desktop-gap': 'clamp(28px, 3.4vw, 48px)',
	'--hit-min': '44px',
	'--shadow-card-hover': '0 10px 26px rgba(43,30,22,.1)',
	// Prototype (Asadorov Explorations.dc.html l.223/349): compact primary
	// "Show results" is "border-radius:13px".
	'--radius-button-compact': '13px',
	// FE-3 navigation. Mobile README -> Screen 2 sticky top bar: "bg
	// rgba(246,239,227,.94) + backdrop-filter: blur(8px)", back button "bg
	// rgba(43,30,22,.07)"; prototype (DishVariations/Recipe.dc.html) back
	// hover "rgba(43,30,22,.13)". Desktop prototype back pill hover
	// "rgba(43,30,22,.11)" (its resting rgba(43,30,22,.06) is already
	// --bg-hover-subtle).
	'--bg-top-bar': 'rgba(246,239,227,.94)',
	'--blur-top-bar': 'blur(8px)',
	'--bg-back-button': 'rgba(43,30,22,.07)',
	'--bg-back-button-hover': 'rgba(43,30,22,.13)',
	'--bg-back-pill-hover': 'rgba(43,30,22,.11)'
};

// Tokens whose value the design leaves open: declared once, any value.
const OPEN_TOKENS = [
	// FE-3 review: the shared :focus-visible ring colour on every control.
	'--focus-ring'
];

function read(repoPath: string): string {
	const file = repoFile(repoPath);
	expect(existsSync(file), `${repoPath} must exist`).toBe(true);
	return readFileSync(file, 'utf8');
}

function withoutComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalise(value: string): string {
	return value
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/\s*([(),])\s*/g, '$1')
		.replace(/(^|[^\d.])0\./g, '$1.')
		.toLowerCase();
}

// Every `--name: value;` declaration, in order, duplicates included.
function declarations(css: string): [string, string][] {
	const found = withoutComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g);
	return [...found].map((match) => [match[1], normalise(match[2])]);
}

describe('layout.css tokens', () => {
	for (const [name, value] of Object.entries(TOKENS)) {
		it(`declares ${name}: ${value} exactly once`, () => {
			const matching = declarations(read(LAYOUT_CSS)).filter(([n]) => n === name);
			expect(matching.length, `got ${matching.length} declarations of ${name}, want 1`).toBe(1);
			expect(matching[0][1], `got ${name}: ${matching[0][1]}`).toBe(normalise(value));
		});
	}

	for (const name of OPEN_TOKENS) {
		it(`declares ${name} exactly once, with a value`, () => {
			const matching = declarations(read(LAYOUT_CSS)).filter(([n]) => n === name);
			expect(matching.length, `got ${matching.length} declarations of ${name}, want 1`).toBe(1);
			expect(matching[0][1], `got an empty ${name}`).not.toBe('');
		});
	}

	it('declares them on :root', () => {
		const css = withoutComments(read(LAYOUT_CSS));
		expect(css, 'want a :root rule').toMatch(/:root\s*\{/);
	});
});

// stack.md X10 "Contrast overrides" (owner, 2026-10-21): the design text
// colours that miss WCAG AA 4.5:1 on the cream backgrounds, overridden here
// with the nearest passing values while tokens.css stays the design's byte
// mirror. The one place these values are pinned.
const CONTRAST_OVERRIDES: Record<string, string> = {
	'--ink-2': 'rgba(43,30,22,.64)',
	'--ink-3': 'rgba(43,30,22,.65)',
	'--ink-placeholder': 'rgba(43,30,22,.63)',
	'--ink-eyebrow': 'rgba(43,30,22,.63)',
	'--accent-text': '#b44e2a',
	'--accent-text-hover': '#a84727',
	// Filled buttons (same decision): --on-accent on --accent is 3.99:1.
	'--bg-button': '#b64f2b',
	'--bg-button-hover': '#a84727'
};

describe('layout.css AA contrast overrides', () => {
	for (const [name, value] of Object.entries(CONTRAST_OVERRIDES)) {
		it(`declares ${name}: ${value} exactly once`, () => {
			const matching = declarations(read(LAYOUT_CSS)).filter(([n]) => n === name);
			expect(matching.length, `got ${matching.length} declarations of ${name}, want 1`).toBe(1);
			expect(matching[0][1], `got ${name}: ${matching[0][1]}`).toBe(normalise(value));
		});
	}

	it('keeps --accent itself for backgrounds: layout.css does not override it', () => {
		const names = declarations(read(LAYOUT_CSS)).map(([n]) => n);
		expect(names, 'got --accent overridden in layout.css').not.toContain('--accent');
	});
});

describe('layout.css wiring', () => {
	it('is loaded app-wide by the root layout, after tokens.css', () => {
		const layout = read('src/routes/+layout.svelte');
		const tokens = layout.indexOf("'#lib/styles/tokens.css'");
		const layoutCss = layout.indexOf("'#lib/styles/layout.css'");
		expect(
			layoutCss,
			'want src/routes/+layout.svelte to import #lib/styles/layout.css'
		).toBeGreaterThan(-1);
		expect(layoutCss, 'want layout.css imported after tokens.css').toBeGreaterThan(tokens);
	});

	// One place per value: layout.css owns the width and caps .page-container
	// with it (FE-3 PR 4: the cap moved off .app-shell so bars can span the
	// viewport).
	it('owns --content-max-width: global.css neither declares nor uses it', () => {
		const global = read('src/lib/styles/global.css');
		const declared = declarations(global).map(([name]) => name);
		expect(declared, 'got --content-max-width still declared in global.css').not.toContain(
			'--content-max-width'
		);
		expect(global, 'got global.css still capping the app shell').not.toContain(
			'var(--content-max-width)'
		);
		expect(
			read('src/lib/styles/layout.css'),
			'want layout.css to cap .page-container with the token'
		).toMatch(/\.page-container\s*\{[^}]*max-width:\s*var\(--content-max-width\)/);
	});
});
