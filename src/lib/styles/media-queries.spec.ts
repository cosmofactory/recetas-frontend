import { globSync, readFileSync } from 'node:fs';
import { parse, parseCss } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../../testutil/load-export';

// FE-3 Desktop tasks: "--bp-desktop: 860px (a single breakpoint, used
// through one media-query helper)" and "Hover styles only under (hover:
// hover)". F6: "Breakpoint 860px"; branch on input capability, not width,
// where it's about interaction. Every stylesheet the app ships (component
// and route <style> blocks and the global CSS) is scanned:
// - a width media feature may only be the desktop breakpoint, from
//   DESKTOP_MIN_WIDTH_PX, written `min-width: 860px`; "below 860" is its
//   exact complement `not all and (min-width: 860px)`. FE-3 review:
//   `max-width: 859.98px` leaves fractional widths (zoom, high DPR) in
//   neither layout, and range syntax (`width < 860px`) is unsupported before
//   Safari 16.4 while stack.md X10 supports iOS/Safari 16, so neither is
//   allowed; no other width, and no device-width;
// - every rule selecting `:hover` sits inside `@media (hover: hover)`, and a
//   prelude that negates or widens it (`not`, `or`, a comma list) doesn't
//   count as gated;
// - no <style> element in .svelte markup (e.g. inside <svelte:head>): the
//   component's one top-level <style> is the only CSS it ships, so the scan
//   sees all of it.
// tokens.css (the design mirror) is excluded; it holds no rules. Generated
// Paraglide output and test harnesses are not shipped CSS.

const BREAKPOINTS_MODULE = 'src/lib/ui/breakpoints.ts';
const SCANNED = 'src/**/*.{svelte,css}';
const EXCLUDED = [/^src\/lib\/styles\/tokens\.css$/, /^src\/lib\/paraglide\//, /^src\/testutil\//];
const HOVER_MEDIA = /\(\s*hover\s*:\s*hover\s*\)/;
// A prelude that negates the hover condition or adds an alternative to it.
const WIDENED_MEDIA = /\bnot\b|\bor\b|,/i;
const MEDIA_FEATURE = /\(([^()]*)\)/g;
const WIDTH_FEATURE = /width/;

type CssNode = {
	type: string;
	name?: string;
	prelude?: string | { start: number; end: number };
	block?: { children: CssNode[] } | null;
	children?: CssNode[];
};

type Sheet = { file: string; source: string; nodes: CssNode[] };

type Found = { file: string; text: string };

function shippedStylesheets(): Sheet[] {
	const files = globSync(SCANNED, { cwd: repoFile('') }).sort();
	return files
		.filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
		.map((file) => sheetOf(file, readFileSync(repoFile(file), 'utf8')))
		.filter((sheet) => sheet.nodes.length > 0);
}

function sheetOf(file: string, source: string): Sheet {
	if (file.endsWith('.css')) return { file, source, nodes: parseCss(source).children as CssNode[] };
	const css = parse(source, { modern: true }).css;
	return { file, source, nodes: (css?.children ?? []) as CssNode[] };
}

function childrenOf(node: CssNode): CssNode[] {
	return node.block?.children ?? node.children ?? [];
}

// Every node with the chain of @media preludes around it.
function* walk(nodes: CssNode[], media: string[] = []): Generator<[CssNode, string[]]> {
	for (const node of nodes) {
		yield [node, media];
		const isMedia = node.type === 'Atrule' && node.name === 'media';
		const inner = isMedia ? [...media, String(node.prelude)] : media;
		yield* walk(childrenOf(node), inner);
	}
}

function selectorText(sheet: Sheet, node: CssNode): string {
	const prelude = node.prelude as { start: number; end: number };
	return sheet.source.slice(prelude.start, prelude.end);
}

function normalise(feature: string): string {
	return feature.replace(/\s+/g, '').toLowerCase();
}

function allowedWidthFeatures(minWidthPx: number): Set<string> {
	return new Set([`min-width:${minWidthPx}px`]);
}

function isHoverGated(prelude: string): boolean {
	return HOVER_MEDIA.test(prelude) && !WIDENED_MEDIA.test(prelude);
}

type MarkupNode = { type?: string; name?: string; start?: number };

// Every <style> element in a component's markup, at any depth (the
// top-level <style> is parsed into `css`, not the fragment).
function markupStyleElements(source: string): number[] {
	const found: number[] = [];
	const visit = (value: unknown) => {
		if (Array.isArray(value)) return value.forEach(visit);
		if (value === null || typeof value !== 'object') return;
		const node = value as MarkupNode;
		if (node.type === 'RegularElement' && node.name === 'style') found.push(node.start ?? -1);
		Object.values(node).forEach(visit);
	};
	visit(parse(source, { modern: true }).fragment);
	return found;
}

function lineOf(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

function componentFiles(): string[] {
	return globSync('src/**/*.svelte', { cwd: repoFile('') })
		.filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
		.sort();
}

// The @media preludes around each rule selecting `className`.
function mediaAround(sheet: Sheet, className: string): string[][] {
	return [...walk(sheet.nodes)]
		.filter(([node]) => node.type === 'Rule' && selectorText(sheet, node).includes(className))
		.map(([, media]) => media.map(normalise));
}

function widthFeatures(prelude: string): string[] {
	return [...prelude.matchAll(MEDIA_FEATURE)]
		.map((match) => normalise(match[1]))
		.filter((feature) => WIDTH_FEATURE.test(feature));
}

function disallowedWidthQueries(sheets: Sheet[], allowed: Set<string>): Found[] {
	return sheets.flatMap((sheet) =>
		[...walk(sheet.nodes)]
			.filter(([node]) => node.type === 'Atrule' && node.name === 'media')
			.flatMap(([node]) => widthFeatures(String(node.prelude)))
			.filter((feature) => !allowed.has(feature))
			.map((text) => ({ file: sheet.file, text }))
	);
}

function ungatedHoverSelectors(sheets: Sheet[]): Found[] {
	return sheets.flatMap((sheet) =>
		[...walk(sheet.nodes)]
			.filter(([node]) => node.type === 'Rule' && selectorText(sheet, node).includes(':hover'))
			.filter(([, media]) => !media.some(isHoverGated))
			.map(([node]) => ({ file: sheet.file, text: selectorText(sheet, node) }))
	);
}

describe('shipped stylesheets', () => {
	it('are found (the scan sees component, route and global CSS)', () => {
		const files = shippedStylesheets().map((sheet) => sheet.file);
		expect(files, 'want a component stylesheet').toContain(
			'src/lib/components/ui/SegmentedSwitch.svelte'
		);
		expect(files, 'want the global layout stylesheet').toContain('src/lib/styles/layout.css');
	});

	it('use no width media query but the desktop breakpoint', async () => {
		const minWidth = await loadExport<number>(BREAKPOINTS_MODULE, 'DESKTOP_MIN_WIDTH_PX');
		const found = disallowedWidthQueries(shippedStylesheets(), allowedWidthFeatures(minWidth));
		expect(found, `got other width queries ${JSON.stringify(found)}`).toEqual([]);
	});

	it('use the desktop breakpoint somewhere (the .desktop-only/.mobile-only helper)', async () => {
		const minWidth = await loadExport<number>(BREAKPOINTS_MODULE, 'DESKTOP_MIN_WIDTH_PX');
		const layout = shippedStylesheets().find((sheet) => sheet.file === 'src/lib/styles/layout.css');
		const features = [...walk(layout?.nodes ?? [])]
			.filter(([node]) => node.type === 'Atrule' && node.name === 'media')
			.flatMap(([node]) => widthFeatures(String(node.prelude)));
		const allowed = allowedWidthFeatures(minWidth);
		expect(
			features.some((feature) => allowed.has(feature)),
			`got width features ${JSON.stringify(features)} in layout.css, want the ${minWidth}px breakpoint`
		).toBe(true);
	});

	it('style :hover only under @media (hover: hover)', () => {
		const found = ungatedHoverSelectors(shippedStylesheets());
		expect(found, `got ungated :hover rules ${JSON.stringify(found)}`).toEqual([]);
	});

	it('hide .desktop-only below 860px with `not all and (min-width: 860px)`', async () => {
		const minWidth = await loadExport<number>(BREAKPOINTS_MODULE, 'DESKTOP_MIN_WIDTH_PX');
		const layout = shippedStylesheets().find((sheet) => sheet.file === 'src/lib/styles/layout.css');
		const media = mediaAround(layout!, '.desktop-only');
		expect(media, `got .desktop-only under ${JSON.stringify(media)}`).toEqual([
			[normalise(`not all and (min-width: ${minWidth}px)`)]
		]);
	});

	it('put no <style> element in component markup', () => {
		const found = componentFiles().flatMap((file) => {
			const source = readFileSync(repoFile(file), 'utf8');
			return markupStyleElements(source).map((offset) => `${file}:${lineOf(source, offset)}`);
		});
		expect(found, `got <style> in markup at ${JSON.stringify(found)}`).toEqual([]);
	});
});

// The scanner itself, on inline sources, so a rule it should catch is
// known to be caught.
describe('stylesheet scan', () => {
	const hoverCases = [
		{ name: 'gated', css: '@media (hover: hover) { .a:hover { opacity: 0 } }', ungated: 0 },
		{ name: 'ungated', css: '.a:hover { opacity: 0 }', ungated: 1 },
		{ name: 'negated', css: '@media not (hover: hover) { .a:hover { opacity: 0 } }', ungated: 1 },
		{ name: 'not all and', css: '@media not all and (hover: hover) { .a:hover {} }', ungated: 1 },
		{ name: 'or', css: '@media (hover: hover) or (width < 860px) { .a:hover {} }', ungated: 1 },
		{ name: 'listed', css: '@media (hover: hover), print { .a:hover {} }', ungated: 1 },
		{ name: 'nested', css: '@media (hover: hover) { .a { &:hover { opacity: 0 } } }', ungated: 0 }
	];
	for (const { name, css, ungated } of hoverCases) {
		it(`counts ${ungated} ungated :hover rule(s) in the ${name} case`, () => {
			const found = ungatedHoverSelectors([sheetOf('case.css', css)]);
			expect(found.length, `got ${JSON.stringify(found)}`).toBe(ungated);
		});
	}

	const styleCases = [
		{ name: 'a top-level <style>', svelte: '<p>x</p><style>p { margin: 0 }</style>', found: 0 },
		{
			name: 'a <style> in <svelte:head>',
			svelte: '<svelte:head><style>p { margin: 0 }</style></svelte:head><p>x</p>',
			found: 1
		},
		{ name: 'a <style> in an element', svelte: '<div><style>p {}</style></div>', found: 1 }
	];
	for (const { name, svelte, found } of styleCases) {
		it(`finds ${found} markup <style> element(s) in ${name}`, () => {
			expect(markupStyleElements(svelte).length).toBe(found);
		});
	}
});
