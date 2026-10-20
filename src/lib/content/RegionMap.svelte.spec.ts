import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	MAP_COLUMNS,
	MAP_ROWS,
	regionHref,
	regionsIn,
	type GridCell,
	type Lang,
	type LabelPosition,
	type MapGrid,
	type MapRegion,
	type ParseGrid,
	type Region,
	tileColorOf
} from '../../testutil/map';
import {
	computed,
	emulateForcedColors,
	expectFullyVisible,
	loadContent,
	loadMapExport,
	resetEmulatedMedia,
	stage,
	style,
	textLineCount,
	transitionDuration,
	ungatedHoverRules,
	useViewport
} from '../../testutil/ui';

// FE-4 RegionMap: the Spain mosaic, a content component (src/lib/content/,
// data and callbacks only) used by the mobile home and the desktop Regional
// grid. Sources, by line:
// - Mobile README -> Map (shared) L114–117: "CSS grid, 14 columns × 11 rows,
//   aspect-ratio: 14 / 11, width 100%, gap 3px. Cells are square." "Each
//   cell: radius 4px, bg = region tileColor; the selected region's cells are
//   --region-selected. Hover brightness(1.1). Bg transition 200ms. Whole
//   region is one tap target (any cell selects it)." "Labels: one per region,
//   absolutely positioned at the centroid of its cells plus labelNudges (in
//   cell units), translate(-50%,-50%). Style: 9.5px/700 ink, bg
//   --map-label-bg, padding 2px 4px, radius 4px, nowrap, pointer-events none."
//   Mobile prototype (Asadorov Explorations.dc.html, 2a) L284–293: the same
//   values, cells `transition:background .2s,filter .2s`; no hover or
//   selected change on the label.
// - Desktop README -> Regional L54: "width 100% with max-width max(560px,
//   calc((100vh − 360px) × 14/11)), cell gap 5px, radius 6px. Hover: cell
//   brightness(1.12), its label turns solid surface with a shadow. Selected:
//   ink cells, ink label with --on-accent text. Labels 12px/700, padding 3px
//   8px, radius 6px." L57: "the map never shrinks below 560px". Desktop
//   prototype (Asadorov Desktop.dc.html) L90–100 and L757–774: max-width on
//   the aspect-ratio box itself, cells `transition:background .2s,filter
//   .15s`, no brightness on the selected region (`key === hov && key !==
//   sel`), label bg `on ? ink : (h ? #FBF7EC : rgba(251,247,236,.85))`, fg
//   `on ? #F8F1E4 : ink`, shadow `(on || h) ? 0 3px 10px rgba(43,30,22,.22)`,
//   label `transition:background .15s,color .15s`.
// - Accessibility (both READMEs): "Map regions need accessible names
//   ("Galicia") and must be keyboard-focusable. Provide the region list as a
//   fallback for screen readers." Stage FE-4: "one <button> or link per
//   region, with its cells as visual children ... Enter or Space selects it";
//   labels "don't truncate with long ru names"; hover only under (hover:
//   hover).
//
// Decisions pinned here (see the FE-4 PR 1 report):
// - Regions are links to hrefFor(key) (/:lang/regions/:key), so SSR deep
//   links and no-JS work; Enter activates a link natively, Space is added.
// - Props: { regions (API order), selectedKey?, hrefFor }. The map draws a
//   region only when the API returns it, in prop order; colours from
//   region.tileColor, label text from region.mapLabel. The selected link
//   carries aria-current.
// - Accessible name (WCAG 2.5.3 label in name, coordinator 2026-10-20): it
//   starts with the visible mapLabel and also contains region.name when they
//   differ ("Euskadi" + "Basque Country"); when equal it is just that text.
//   The label chip is the link's text and the full name visually hidden text
//   when it differs, so the link has no aria-label.
// - The map IS the screen-reader region list (FE-4 PR 1 review): the
//   data-testid="region-map" box is a list (<ul>) of one item per drawn
//   region, each holding that region's one link, so screen readers announce
//   "list, 14 items" once. There is no separate hidden list.
// - tileColor is validated once at the server boundary (#RRGGBB); a bad one
//   arrives as null and its cells draw --placeholder.
// - Forced colours: every cell keeps a visible outline or border, and the
//   selected region's cells are Highlight (the rule lives in layout.css).
// - Space activates only a plain, first press: not a key repeat, not with
//   Shift, Ctrl, Alt or Meta held.
// - Test hooks: the 14 × 11 aspect-ratio box is data-testid="region-map";
//   cells are [data-map-cell] grid items placed on their 1-based grid lines
//   (parseGrid), aria-hidden; each region's label is one [data-map-label]
//   chip inside its link.
// - Hovering any cell of a region styles all of its cells (the desktop
//   prototype's `hov` is a region key; the region is one target).
// - Focus: keyboard focus draws the shared ring (--focus-ring,
//   --focus-ring-width) on the region's label, and never a box around the
//   whole map. Keyboard users tab through the 14 visible links once. The ring
//   on the label is a
//   documented exception to "components never style focus" (its rule lives
//   in layout.css).
// - Sizing is the screen's (PR 2): RegionMap fills its container at 14 / 11
//   at every width. The mobile gutter (390 − 2 × 16, prototype L280
//   `padding:14px 16px 16px`) is applied by the screen.
//   TODO(FE-4 PR 2): the Regional screen spec must pin the desktop map width
//   max(560px, calc((100vh − 360px) × 14/11)) and the 560px floor (desktop
//   README L54, L57) at 1280×800 → 560, 1440×900 → 687.3, 1280×600 → 560,
//   1280×1100 → 941.8 in a wide column, and resolve the 860px viewport, where
//   the minmax(0,1.4fr) column is only ~456px.

type RegionMapProps = {
	regions: MapRegion[];
	selectedKey?: string;
	hrefFor: (key: string) => string;
};

type RenderOptions = { lang?: Lang; width?: number; regions?: MapRegion[]; selectedKey?: string };

const MAP_TEST_ID = 'region-map';
const CELL = '[data-map-cell]';
const LABEL = '[data-map-label]';
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
// Layout snaps to 1/64px; labels are centred with a sub-pixel translate.
const PX_TOLERANCE = 0.5;
const GAP_TOLERANCE_PX = 0.1;

const MOBILE_GAP_PX = 3;
const DESKTOP_GAP_PX = 5;
const MOBILE_RADIUS = 'var(--radius-map-cell)';
const DESKTOP_RADIUS_PX = '6px';
const MAP_MIN_DESKTOP_PX = 560;
const MOBILE_GUTTER_PX = 16;

const MOBILE_HOVER_FILTER = 'brightness(1.1)';
const DESKTOP_HOVER_FILTER = 'brightness(1.12)';
const DESKTOP_LABEL_BG = 'rgba(251,247,236,.85)';
const DESKTOP_LABEL_SHADOW = '0 3px 10px rgba(43,30,22,.22)';
const DESKTOP_FILTER_MS = '0.15s';
const DESKTOP_LABEL_MS = '0.15s';

const gridFiles = import.meta.glob('../map/map-grid.json', { eager: true, import: 'default' });

afterEach(() => (document.activeElement as HTMLElement | null)?.blur());

// --- rendering and lookup ---------------------------------------------------

async function renderMap(options: RenderOptions = {}, target = mapStage(options.width)) {
	const lang = options.lang ?? 'en';
	const RegionMap = await loadContent<RegionMapProps>('RegionMap');
	const props: RegionMapProps = {
		regions: options.regions ?? regionsIn(lang),
		hrefFor: regionHref(lang),
		...(options.selectedKey ? { selectedKey: options.selectedKey } : {})
	};
	await render(RegionMap, { target, props });
	const map = page.getByTestId(MAP_TEST_ID);
	await expect.element(map).toBeInTheDocument();
	return map.element() as HTMLElement;
}

// A container of the given content width, like the screen column the map sits in.
function mapStage(width = 358): HTMLElement {
	return stage(`width: ${width}px; margin: 40px ${MOBILE_GUTTER_PX}px`);
}

function mapLinks(map: HTMLElement): HTMLAnchorElement[] {
	return [...map.querySelectorAll<HTMLAnchorElement>('a')];
}

function linkOf(map: HTMLElement, key: string, lang: Lang = 'en'): HTMLAnchorElement {
	const href = regionHref(lang)(key);
	const link = mapLinks(map).find((a) => a.getAttribute('href') === href);
	expect(link, `got no map link to ${href}`).toBeDefined();
	return link!;
}

function cellsOf(link: Element): HTMLElement[] {
	return [...link.querySelectorAll<HTMLElement>(CELL)];
}

function allCells(map: HTMLElement): HTMLElement[] {
	return [...map.querySelectorAll<HTMLElement>(CELL)];
}

function labelOf(link: Element): HTMLElement {
	const labels = link.querySelectorAll<HTMLElement>(LABEL);
	expect(labels.length, `got ${labels.length} labels in ${link.getAttribute('href')}`).toBe(1);
	return labels[0];
}

function gridLines(cell: Element): GridCell {
	return {
		row: Number(style(cell, 'grid-row-start')),
		col: Number(style(cell, 'grid-column-start'))
	};
}

function cellAt(map: HTMLElement, row: number, col: number): HTMLElement {
	const cell = allCells(map).find((c) => {
		const lines = gridLines(c);
		return lines.row === row && lines.col === col;
	});
	expect(cell, `got no cell at row ${row}, col ${col}`).toBeDefined();
	return cell!;
}

function byLines(a: GridCell, b: GridCell): number {
	return a.row - b.row || a.col - b.col;
}

async function layout(): Promise<{ grid: MapGrid; cells: Map<string, GridCell[]> }> {
	const grid = gridFiles['../map/map-grid.json'] as MapGrid | undefined;
	expect(grid, 'src/lib/map/map-grid.json must exist (D-FE4-1)').toBeDefined();
	const parseGrid = await loadMapExport<ParseGrid>('grid.ts', 'parseGrid');
	return { grid: grid!, cells: parseGrid(grid!) };
}

// WCAG 2.5.3: the visible label first; the full name too when it differs.
function accessibleName(region: Region): RegExp {
	const label = escapeRegExp(region.mapLabel);
	if (region.mapLabel === region.name) return new RegExp(`^${label}$`);
	return new RegExp(`^${label}\\s.*${escapeRegExp(region.name)}`);
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- activation -------------------------------------------------------------

// Every link activation inside `target` (click, Enter, Space), by href; the
// navigation itself is cancelled.
function recordActivations(target: HTMLElement): string[] {
	const hrefs: string[] = [];
	target.addEventListener('click', (event) => {
		const link = (event.target as Element).closest('a');
		if (!link) return;
		event.preventDefault();
		hrefs.push(link.getAttribute('href') ?? '');
	});
	return hrefs;
}

function spaceKeydown(init: KeyboardEventInit): KeyboardEvent {
	return new KeyboardEvent('keydown', {
		key: ' ',
		code: 'Space',
		bubbles: true,
		cancelable: true,
		...init
	});
}

function sentinel(): HTMLButtonElement {
	const button = document.createElement('button');
	button.dataset.sentinel = '';
	return button;
}

// --- geometry ---------------------------------------------------------------

function near(got: number, want: number, what: string, tolerance = PX_TOLERANCE) {
	expect(Math.abs(got - want), `${what}: got ${got}, want ${want}`).toBeLessThanOrEqual(tolerance);
}

function expectAspectRatio(map: HTMLElement, width: number) {
	const rect = map.getBoundingClientRect();
	near(rect.width, width, 'map width');
	near(rect.height, (rect.width * MAP_ROWS) / MAP_COLUMNS, 'map height (14 / 11)');
}

function gapBetween(first: Element, second: Element, axis: 'x' | 'y'): number {
	const a = first.getBoundingClientRect();
	const b = second.getBoundingClientRect();
	return axis === 'x' ? b.left - a.right : b.top - a.bottom;
}

function centre(el: Element): { x: number; y: number } {
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function expectLabelsAtCentroids(map: HTMLElement) {
	const { grid, cells } = await layout();
	const labelPosition = await loadMapExport<LabelPosition>('grid.ts', 'labelPosition');
	const box = map.getBoundingClientRect();
	for (const region of regionsIn('en')) {
		const want = labelPosition(cells.get(region.key) ?? [], grid.labelNudges?.[region.key]);
		const got = centre(labelOf(linkOf(map, region.key)));
		near(got.x, box.left + (want.x / MAP_COLUMNS) * box.width, `${region.key} label x`);
		near(got.y, box.top + (want.y / MAP_ROWS) * box.height, `${region.key} label y`);
	}
}

async function expectGap(gapPx: number, width: number) {
	const map = await renderMap({ width });
	// Galicia's (1,2), (2,1), (2,2): neighbours across a column and a row.
	const columnGap = gapBetween(cellAt(map, 2, 1), cellAt(map, 2, 2), 'x');
	near(columnGap, gapPx, 'column gap', GAP_TOLERANCE_PX);
	const rowGap = gapBetween(cellAt(map, 1, 2), cellAt(map, 2, 2), 'y');
	near(rowGap, gapPx, 'row gap', GAP_TOLERANCE_PX);
}

// --- structure ----------------------------------------------------------------

describe('RegionMap regions', () => {
	useViewport(390, 844);

	it('renders exactly one interactive element per region, a link, in region order', async () => {
		const map = await renderMap();
		const focusable = [...map.querySelectorAll(FOCUSABLE)];
		expect(focusable.length, `got ${focusable.length} focusable elements, want 14`).toBe(14);
		expect(focusable.every((el) => el.tagName === 'A')).toBe(true);
		const got = mapLinks(map).map((a) => a.getAttribute('href'));
		expect(got).toEqual(regionsIn('en').map((r) => regionHref('en')(r.key)));
	});

	for (const lang of ['en', 'ru'] as const) {
		it(`names each region link by its mapLabel, then its name if different (${lang})`, async () => {
			const map = await renderMap({ lang });
			const locator = page.getByTestId(MAP_TEST_ID);
			for (const region of regionsIn(lang)) {
				const link = locator.getByRole('link', { name: accessibleName(region) });
				await expect.element(link).toHaveAttribute('href', regionHref(lang)(region.key));
				expect(linkOf(map, region.key, lang).hasAttribute('aria-label'), 'got aria-label').toBe(
					false
				);
			}
		});
	}

	it('draws each region’s cells on the grid lines map-grid.json gives them', async () => {
		const map = await renderMap();
		const { cells } = await layout();
		for (const region of regionsIn('en')) {
			const got = cellsOf(linkOf(map, region.key)).map(gridLines).sort(byLines);
			const want = [...(cells.get(region.key) ?? [])].sort(byLines);
			expect(got, `got ${region.key} cells ${JSON.stringify(got)}`).toEqual(want);
		}
	});

	it('hides the cells from assistive tech', async () => {
		const map = await renderMap();
		for (const cell of allCells(map)) {
			const hidden = cell.closest('[aria-hidden="true"]');
			expect(hidden, 'got a cell exposed to assistive tech').not.toBeNull();
			expect(hidden!.closest('a'), 'want the hidden cells inside the region link').not.toBeNull();
		}
	});

	it('draws one label per region with its mapLabel', async () => {
		const map = await renderMap({ lang: 'ru' });
		for (const region of regionsIn('ru')) {
			const label = labelOf(linkOf(map, region.key, 'ru'));
			expect(label.textContent?.trim()).toBe(region.mapLabel);
		}
	});

	it('draws nothing for a region the API did not return (D-FE4-1)', async () => {
		const regions = regionsIn('en').filter((region) => region.key !== 'can');
		const map = await renderMap({ regions });
		expect(mapLinks(map)).toHaveLength(13);
		const bottomRow = allCells(map).filter((cell) => gridLines(cell).row === MAP_ROWS);
		expect(bottomRow, 'got cells on Canarias’ row').toEqual([]);
		expect(map.textContent, 'got the Canarias label').not.toContain('Canarias');
	});

	it('follows the order of the regions prop', async () => {
		const regions = regionsIn('en').reverse();
		const map = await renderMap({ regions });
		const got = mapLinks(map).map((a) => a.getAttribute('href'));
		expect(got).toEqual(regions.map((r) => regionHref('en')(r.key)));
	});

	it('marks only the selected region’s link with aria-current', async () => {
		const map = await renderMap({ selectedKey: 'gal' });
		for (const link of mapLinks(map)) {
			const current = link.getAttribute('aria-current');
			const isGal = link === linkOf(map, 'gal');
			expect(current !== null && current !== 'false', `aria-current on ${link.href}`).toBe(isGal);
		}
	});
});

describe('RegionMap activation', () => {
	useViewport(390, 844);

	it('activates a region’s link from any of its cells (one tap target)', async () => {
		const target = mapStage();
		const hrefs = recordActivations(target);
		const map = await renderMap({}, target);
		for (const region of regionsIn('en')) {
			const cells = cellsOf(linkOf(map, region.key));
			await userEvent.click(cells[0]);
			await userEvent.click(cells[cells.length - 1]);
		}
		const want = regionsIn('en').flatMap((r) => [regionHref('en')(r.key), regionHref('en')(r.key)]);
		expect(hrefs).toEqual(want);
	});

	it('lets clicks pass through the labels (pointer-events: none)', async () => {
		const map = await renderMap();
		for (const label of map.querySelectorAll<HTMLElement>(LABEL)) {
			expect(style(label, 'pointer-events')).toBe('none');
			const { x, y } = centre(label);
			expect(document.elementFromPoint(x, y), 'got the label under the pointer').not.toBe(label);
		}
	});

	it('activates the focused region on Enter', async () => {
		const target = mapStage();
		const hrefs = recordActivations(target);
		const map = await renderMap({}, target);
		linkOf(map, 'and').focus();
		await userEvent.keyboard('{Enter}');
		expect(hrefs).toEqual([regionHref('en')('and')]);
	});

	it('activates the focused region on Space without scrolling the page', async () => {
		const target = mapStage();
		const hrefs = recordActivations(target);
		const map = await renderMap({}, target);
		const spaceDefaults: boolean[] = [];
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === ' ') spaceDefaults.push(event.defaultPrevented);
		};
		document.addEventListener('keydown', onKeydown);
		linkOf(map, 'gal').focus();
		await userEvent.keyboard(' ');
		document.removeEventListener('keydown', onKeydown);
		expect(hrefs).toEqual([regionHref('en')('gal')]);
		expect(spaceDefaults, 'want the Space keydown default prevented').toEqual([true]);
	});

	const ignoredSpaces: { name: string; init: KeyboardEventInit }[] = [
		{ name: 'a key repeat', init: { repeat: true } },
		{ name: 'Shift+Space', init: { shiftKey: true } },
		{ name: 'Ctrl+Space', init: { ctrlKey: true } },
		{ name: 'Alt+Space', init: { altKey: true } },
		{ name: 'Meta+Space', init: { metaKey: true } }
	];
	for (const { name, init } of ignoredSpaces) {
		it(`ignores ${name}: no navigation`, async () => {
			const target = mapStage();
			const hrefs = recordActivations(target);
			const map = await renderMap({}, target);
			const link = linkOf(map, 'gal');
			link.focus();
			link.dispatchEvent(spaceKeydown(init));
			expect(hrefs, `got activations ${JSON.stringify(hrefs)} for ${name}`).toEqual([]);
		});
	}

	it('reaches every region with Tab, in region order, then leaves the map', async () => {
		const target = mapStage();
		const before = sentinel();
		target.append(before);
		const map = await renderMap({}, target);
		target.append(sentinel());
		before.focus();
		const reached: string[] = [];
		for (let i = 0; i < 14; i++) {
			await userEvent.tab();
			reached.push(document.activeElement?.getAttribute('href') ?? '');
		}
		expect(reached).toEqual(mapLinks(map).map((a) => a.getAttribute('href')));
		await userEvent.tab();
		const after = document.activeElement as HTMLElement | null;
		expect(after?.dataset.sentinel, 'want Tab to leave the map after the 14 regions').toBe('');
	});
});

describe('RegionMap keyboard focus', () => {
	useViewport(390, 844);

	async function focusFirstRegionByKeyboard(map: HTMLElement, target: HTMLElement) {
		target.querySelector<HTMLElement>('[data-sentinel]')!.focus();
		await userEvent.tab();
		expect(document.activeElement).toBe(mapLinks(map)[0]);
		return mapLinks(map)[0];
	}

	async function renderWithSentinel() {
		const target = mapStage();
		target.append(sentinel());
		recordActivations(target);
		return { target, map: await renderMap({}, target) };
	}

	it('draws the shared focus ring on the focused region’s label', async () => {
		const { target, map } = await renderWithSentinel();
		const label = labelOf(mapLinks(map)[0]);
		expect(style(label, 'outline-style'), 'got a ring before focus').toBe('none');
		await focusFirstRegionByKeyboard(map, target);
		expect(style(label, 'outline-style')).toBe('solid');
		expect(style(label, 'outline-color')).toBe(computed('outline-color', 'var(--focus-ring)'));
		expect(style(label, 'outline-width')).toBe(
			computed('outline-width', 'var(--focus-ring-width)', 'outline-style: solid')
		);
	});

	it('never draws the ring as a box around the whole map', async () => {
		const { target, map } = await renderWithSentinel();
		const link = await focusFirstRegionByKeyboard(map, target);
		if (style(link, 'outline-style') === 'none') return;
		const ring = link.getBoundingClientRect();
		const box = map.getBoundingClientRect();
		const spansMap =
			ring.width >= box.width - PX_TOLERANCE && ring.height >= box.height - PX_TOLERANCE;
		expect(spansMap, 'got a focus ring around the whole map').toBe(false);
	});

	it('shows no ring after a pointer click (:focus-visible)', async () => {
		const { map } = await renderWithSentinel();
		const link = linkOf(map, 'gal');
		await userEvent.click(cellsOf(link)[0]);
		expect(style(labelOf(link), 'outline-style')).toBe('none');
	});
});

describe('RegionMap as the region list', () => {
	useViewport(390, 844);

	it('is a list of one item per region, each holding that region’s link, in order', async () => {
		const map = await renderMap();
		expect(page.getByRole('list').element(), 'want the map box to be the list').toBe(map);
		const items = await page.getByTestId(MAP_TEST_ID).getByRole('listitem').all();
		expect(items, `got ${items.length} list items, want 14`).toHaveLength(14);
		const hrefs = items.map((item) => {
			const links = item.element().querySelectorAll('a');
			expect(links.length, 'want exactly one link per list item').toBe(1);
			return links[0].getAttribute('href');
		});
		expect(hrefs).toEqual(regionsIn('en').map((r) => regionHref('en')(r.key)));
	});

	it('has one item per drawn region only (no Canarias item when it is missing)', async () => {
		const regions = regionsIn('en').filter((region) => region.key !== 'can');
		await renderMap({ regions });
		const items = await page.getByTestId(MAP_TEST_ID).getByRole('listitem').all();
		expect(items).toHaveLength(13);
	});

	it('renders no second region list or links outside the map', async () => {
		const target = mapStage();
		const map = await renderMap({}, target);
		const outside = [...target.querySelectorAll('a, ul, ol')].filter((el) => !map.contains(el));
		expect(outside.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
	});
});

describe('RegionMap with an invalid tileColor (nulled by the server)', () => {
	useViewport(390, 844);

	it('draws that region’s cells with --placeholder and keeps the others’ colours', async () => {
		const regions: MapRegion[] = regionsIn('en').map((region) =>
			region.key === 'gal' ? { ...region, tileColor: null } : region
		);
		const map = await renderMap({ regions });
		const placeholder = computed('background-image', 'var(--placeholder)');
		for (const cell of cellsOf(linkOf(map, 'gal'))) {
			expect(style(cell, 'background-image')).toBe(placeholder);
		}
		const ast = cellsOf(linkOf(map, 'ast'))[0];
		const tile = tileColorOf(regionsIn('en').find((r) => r.key === 'ast')!);
		expect(style(ast, 'background-color')).toBe(computed('background-color', tile));
	});
});

describe('RegionMap in forced-colours mode', () => {
	useViewport(390, 844);
	beforeEach(() => emulateForcedColors());
	afterEach(() => resetEmulatedMedia());

	function edgeWidth(cell: Element): number {
		const outline =
			style(cell, 'outline-style') === 'none' ? 0 : parseFloat(style(cell, 'outline-width'));
		return Math.max(outline, parseFloat(style(cell, 'border-top-width')));
	}

	it('keeps a visible outline or border on every cell', async () => {
		expect(matchMedia('(forced-colors: active)').matches, 'want forced colours emulated').toBe(
			true
		);
		const map = await renderMap({ selectedKey: 'gal' });
		for (const cell of allCells(map)) {
			expect(edgeWidth(cell), 'got a cell with no outline or border').toBeGreaterThan(0);
		}
	});

	it('fills the selected region’s cells with Highlight, and only those', async () => {
		const map = await renderMap({ selectedKey: 'gal' });
		const highlight = computed('background-color', 'Highlight', 'forced-color-adjust: none');
		for (const cell of cellsOf(linkOf(map, 'gal'))) {
			expect(style(cell, 'background-color')).toBe(highlight);
		}
		for (const cell of cellsOf(linkOf(map, 'ast'))) {
			expect(style(cell, 'background-color')).not.toBe(highlight);
		}
	});
});

// --- mobile style (< 860px) -----------------------------------------------------

// Each phone width with the map's container: the viewport minus the
// prototype's 16px side padding (L280), which the screen applies (PR 2).
const PHONES = [
	{ width: 390, height: 844 },
	{ width: 360, height: 780 },
	{ width: 430, height: 932 }
];

for (const phone of PHONES) {
	const container = phone.width - 2 * MOBILE_GUTTER_PX;
	describe(`RegionMap at ${phone.width}×${phone.height}`, () => {
		useViewport(phone.width, phone.height);

		it(`fills its ${container}px container at 14 / 11`, async () => {
			const map = await renderMap({ width: container });
			expect(style(map, 'aspect-ratio')).toBe('14 / 11');
			expectAspectRatio(map, container);
		});

		it('draws square cells, 14 across with 3px gaps', async () => {
			const map = await renderMap({ width: container });
			const want = (container - (MAP_COLUMNS - 1) * MOBILE_GAP_PX) / MAP_COLUMNS;
			for (const cell of allCells(map)) {
				const rect = cell.getBoundingClientRect();
				near(rect.width, want, 'cell width');
				near(rect.height, rect.width, 'cell height (square)');
			}
		});

		it('places each label at its centroid plus nudge', async () => {
			await expectLabelsAtCentroids(await renderMap({ width: container }));
		});

		it('never truncates or wraps a Russian label', async () => {
			const map = await renderMap({ lang: 'ru', width: container });
			for (const region of regionsIn('ru')) {
				const label = labelOf(linkOf(map, region.key, 'ru'));
				expectFullyVisible(label, region.mapLabel);
				expect(textLineCount(label), `got ${region.mapLabel} on several lines`).toBe(1);
			}
		});
	});
}

describe('RegionMap mobile style', () => {
	useViewport(390, 844);

	it(`spaces cells ${MOBILE_GAP_PX}px apart across rows and columns`, async () => {
		await expectGap(MOBILE_GAP_PX, 358);
	});

	it('rounds cells with --radius-map-cell (4px)', async () => {
		const map = await renderMap();
		const want = computed('border-top-left-radius', MOBILE_RADIUS);
		for (const cell of allCells(map)) expect(style(cell, 'border-top-left-radius')).toBe(want);
	});

	it('fills each region’s cells with its tileColor, the selected one with --region-selected', async () => {
		const map = await renderMap({ selectedKey: 'gal' });
		for (const region of regionsIn('en')) {
			const want =
				region.key === 'gal'
					? computed('background-color', 'var(--region-selected)')
					: computed('background-color', tileColorOf(region));
			for (const cell of cellsOf(linkOf(map, region.key))) {
				await expect
					.poll(() => style(cell, 'background-color'), { message: region.key })
					.toBe(want);
			}
		}
	});

	it('transitions the cell background and filter over 200ms (--dur-colour)', async () => {
		const map = await renderMap();
		const want = computed('transition-duration', 'var(--dur-colour)');
		const cell = allCells(map)[0];
		expect(transitionDuration(cell, 'background-color'), 'background').toBe(want);
		expect(transitionDuration(cell, 'filter'), 'filter').toBe(want);
	});

	it('styles labels 9.5px/700 ink on --map-label-bg, padding 2px 4px, radius 4px, nowrap', async () => {
		const map = await renderMap();
		for (const label of map.querySelectorAll<HTMLElement>(LABEL)) {
			expect(style(label, 'font-size')).toBe('9.5px');
			expect(style(label, 'font-weight')).toBe('700');
			expect(style(label, 'color')).toBe(computed('color', 'var(--ink)'));
			expect(style(label, 'background-color')).toBe(
				computed('background-color', 'var(--map-label-bg)')
			);
			expect(style(label, 'padding')).toBe('2px 4px');
			expect(style(label, 'border-top-left-radius')).toBe('4px');
			expect(style(label, 'white-space')).toBe('nowrap');
		}
	});

	it(`brightens every cell of the hovered region (${MOBILE_HOVER_FILTER}), nothing else`, async () => {
		const map = await renderMap();
		const gal = cellsOf(linkOf(map, 'gal'));
		await userEvent.hover(gal[0]);
		const want = computed('filter', MOBILE_HOVER_FILTER);
		for (const cell of gal) await expect.poll(() => style(cell, 'filter')).toBe(want);
		for (const cell of cellsOf(linkOf(map, 'ast'))) expect(style(cell, 'filter')).toBe('none');
	});

	it('leaves the label unchanged on hover and when selected (mobile prototype)', async () => {
		const map = await renderMap({ selectedKey: 'gal' });
		const link = linkOf(map, 'gal');
		await userEvent.hover(cellsOf(link)[0]);
		const label = labelOf(link);
		const bg = computed('background-color', 'var(--map-label-bg)');
		await expect.poll(() => style(label, 'background-color')).toBe(bg);
		expect(style(label, 'color')).toBe(computed('color', 'var(--ink)'));
	});

	it('styles :hover only under (hover: hover)', async () => {
		const map = await renderMap();
		const link = linkOf(map, 'gal');
		for (const el of [link, cellsOf(link)[0], labelOf(link)]) {
			const rules = ungatedHoverRules(el);
			expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		}
	});

	it('uses the pointer cursor on cells', async () => {
		const map = await renderMap();
		expect(style(allCells(map)[0], 'cursor')).toBe('pointer');
	});
});

// --- desktop style (≥ 860px) ----------------------------------------------------

// Sizing (max-width, the 560px floor) is the screen's: see the TODO above.
const DESKTOP_CONTAINERS = [MAP_MIN_DESKTOP_PX, 900, 1200];

for (const container of DESKTOP_CONTAINERS) {
	describe(`RegionMap at 1280×800 in a ${container}px column`, () => {
		useViewport(1280, 800);

		it(`fills the ${container}px column at 14 / 11`, async () => {
			const map = await renderMap({ width: container });
			expect(style(map, 'aspect-ratio')).toBe('14 / 11');
			expectAspectRatio(map, container);
		});
	});
}

describe('RegionMap desktop style', () => {
	useViewport(1280, 800);

	it(`spaces cells ${DESKTOP_GAP_PX}px apart across rows and columns`, async () => {
		await expectGap(DESKTOP_GAP_PX, 900);
	});

	it(`rounds cells ${DESKTOP_RADIUS_PX}`, async () => {
		const map = await renderMap({ width: 900 });
		for (const cell of allCells(map)) {
			expect(style(cell, 'border-top-left-radius')).toBe(DESKTOP_RADIUS_PX);
		}
	});

	it('places each label at its centroid plus nudge', async () => {
		await expectLabelsAtCentroids(await renderMap({ width: 900 }));
	});

	it('styles labels 12px/700 ink, padding 3px 8px, radius 6px, prototype bg, no shadow', async () => {
		const map = await renderMap({ width: 900 });
		for (const label of map.querySelectorAll<HTMLElement>(LABEL)) {
			expect(style(label, 'font-size')).toBe('12px');
			expect(style(label, 'font-weight')).toBe('700');
			expect(style(label, 'padding')).toBe('3px 8px');
			expect(style(label, 'border-top-left-radius')).toBe('6px');
			expect(style(label, 'color')).toBe(computed('color', 'var(--ink)'));
			expect(style(label, 'background-color')).toBe(computed('background-color', DESKTOP_LABEL_BG));
			expect(style(label, 'box-shadow')).toBe('none');
		}
	});

	it('never truncates a Russian label in a 560px-wide map', async () => {
		const map = await renderMap({ lang: 'ru', width: MAP_MIN_DESKTOP_PX });
		for (const region of regionsIn('ru')) {
			const label = labelOf(linkOf(map, region.key, 'ru'));
			expectFullyVisible(label, region.mapLabel);
			expect(textLineCount(label)).toBe(1);
		}
	});

	it(`on hover brightens the region (${DESKTOP_HOVER_FILTER}) and lifts its label`, async () => {
		const map = await renderMap({ width: 900 });
		const link = linkOf(map, 'gal');
		await userEvent.hover(cellsOf(link)[0]);
		const filter = computed('filter', DESKTOP_HOVER_FILTER);
		for (const cell of cellsOf(link)) await expect.poll(() => style(cell, 'filter')).toBe(filter);
		const label = labelOf(link);
		const surface = computed('background-color', 'var(--bg-surface)');
		await expect.poll(() => style(label, 'background-color')).toBe(surface);
		expect(style(label, 'box-shadow')).toBe(computed('box-shadow', DESKTOP_LABEL_SHADOW));
		for (const cell of cellsOf(linkOf(map, 'ast'))) expect(style(cell, 'filter')).toBe('none');
	});

	it('draws the selected region in ink: cells, label bg, --on-accent text, shadow', async () => {
		const map = await renderMap({ width: 900, selectedKey: 'gal' });
		const link = linkOf(map, 'gal');
		const ink = computed('background-color', 'var(--region-selected)');
		for (const cell of cellsOf(link)) {
			await expect.poll(() => style(cell, 'background-color')).toBe(ink);
		}
		const label = labelOf(link);
		await expect
			.poll(() => style(label, 'background-color'))
			.toBe(computed('background-color', 'var(--ink)'));
		expect(style(label, 'color')).toBe(computed('color', 'var(--on-accent)'));
		expect(style(label, 'box-shadow')).toBe(computed('box-shadow', DESKTOP_LABEL_SHADOW));
	});

	it('does not brighten the selected region on hover', async () => {
		const map = await renderMap({ width: 900, selectedKey: 'gal' });
		const cells = cellsOf(linkOf(map, 'gal'));
		await userEvent.hover(cells[0]);
		for (const cell of cells) expect(style(cell, 'filter')).toBe('none');
	});

	it('transitions the cell filter and the label colours over 150ms (prototype)', async () => {
		const map = await renderMap({ width: 900 });
		const link = linkOf(map, 'gal');
		const cell = cellsOf(link)[0];
		const label = labelOf(link);
		expect(transitionDuration(cell, 'filter'), 'cell filter').toBe(DESKTOP_FILTER_MS);
		const background = computed('transition-duration', 'var(--dur-colour)');
		expect(transitionDuration(cell, 'background-color'), 'cell background').toBe(background);
		expect(transitionDuration(label, 'background-color'), 'label bg').toBe(DESKTOP_LABEL_MS);
		expect(transitionDuration(label, 'color'), 'label colour').toBe(DESKTOP_LABEL_MS);
	});

	it('styles :hover only under (hover: hover)', async () => {
		const map = await renderMap({ width: 900 });
		const link = linkOf(map, 'gal');
		for (const el of [link, cellsOf(link)[0], labelOf(link)]) {
			const rules = ungatedHoverRules(el);
			expect(rules, `got ungated :hover rules ${JSON.stringify(rules)}`).toEqual([]);
		}
	});
});

// Breakpoint crossings keep the map mounted; only the styles change.
describe('RegionMap across 860px', () => {
	beforeEach(() => page.viewport(859, 800));
	afterEach(() => page.viewport(414, 896));

	it('switches gap 3px → 5px between 859px and 860px', async () => {
		const map = await renderMap({ width: 600 });
		near(
			gapBetween(cellAt(map, 2, 1), cellAt(map, 2, 2), 'x'),
			MOBILE_GAP_PX,
			'859px gap',
			GAP_TOLERANCE_PX
		);
		await page.viewport(860, 800);
		await expect
			.poll(() => gapBetween(cellAt(map, 2, 1), cellAt(map, 2, 2), 'x'))
			.toBeCloseTo(DESKTOP_GAP_PX, 1);
	});
});
