import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { regionHref, regionsIn, type Lang, type MapRegion } from '../../testutil/map';
import {
	expectFullyVisible,
	hitArea,
	loadContent,
	loadUi,
	stage,
	style,
	textLineCount,
	useViewport
} from '../../testutil/ui';

// D-REG-1 (owner, 2026-11-23), RegionChips: the mobile region chip row under
// the map. Sources:
// - Mobile README -> Regional tab — body: "Region chips (D-REG-1), directly
//   under the map: one horizontally scrolling chip row (the same chip style
//   as the Popular filter bar, full 44px hit area) with all 17 regions in
//   map order, each labelled with the region `name`. Tapping a chip does
//   exactly what tapping the region on the map does (selects it and opens
//   the sheet at peek); the selected region's chip shows the active chip
//   style. The row doesn't wrap; no "all" chip."
// - Mobile README -> Accessibility: map tiles are exempt from 44px; "the
//   region chips under the map are their full-size equivalent".
//
// Decisions pinned here (assumed interface, see the D-REG-1 test report):
// - src/lib/content/RegionChips.svelte, a content component like RegionMap:
//   props { regions (API = map order), selectedKey?, hrefFor, onActivate? };
//   root data-testid="region-chips". It renders the regions it is given, in
//   that order; the screen (RegionalTab) passes the same list as the map.
// - Each chip is a link to hrefFor(key) (/:lang/regions/:key), like the
//   map's region links, so it works without JavaScript and gives the same
//   URL; onActivate(key, event) hears its click before it is followed (the
//   screen records the opener, as for the map).
// - The selected chip carries aria-current="true" (a link can't be
//   aria-pressed) and the Chip primitive's pressed look; no other chip has
//   aria-current.
// - Built from ChipRow (non-wrapping, scrolls sideways) and Chip (the same
//   box, type and colours as the filter bar's chips).

type RegionChipsProps = {
	regions: MapRegion[];
	selectedKey?: string;
	hrefFor: (key: string) => string;
	onActivate?: (key: string, event: MouseEvent) => void;
};

type ChipProps = { label: string; pressed: boolean; onToggle: (pressed: boolean) => void };

type RenderOptions = { lang?: Lang; width?: number; selectedKey?: string };

const TEST_ID = 'region-chips';
const MOBILE_CONTENT_WIDTH_PX = 358;
const NARROW_CONTENT_WIDTH_PX = 328;
const HIT_MIN_PX = 44;
const PX_TOLERANCE = 1;

// The Chip primitive's box and type, compared property by property.
const CHIP_LOOK = [
	'padding-top',
	'padding-left',
	'border-top-width',
	'border-top-style',
	'border-top-left-radius',
	'font-size',
	'font-weight',
	'font-family',
	'white-space'
];
const CHIP_COLOURS = ['background-color', 'color', 'border-top-color'];

afterEach(() => (document.activeElement as HTMLElement | null)?.blur());

async function renderChips(options: RenderOptions = {}, target?: HTMLElement) {
	const lang = options.lang ?? 'en';
	const RegionChips = await loadContent<RegionChipsProps>('RegionChips');
	const props: RegionChipsProps = {
		regions: regionsIn(lang),
		hrefFor: regionHref(lang),
		...(options.selectedKey ? { selectedKey: options.selectedKey } : {})
	};
	const host = target ?? stage(`width: ${options.width ?? MOBILE_CONTENT_WIDTH_PX}px`);
	await render(RegionChips, { target: host, props });
	const root = page.getByTestId(TEST_ID);
	await expect.element(root).toBeInTheDocument();
	return root.element() as HTMLElement;
}

function chipLinks(root: HTMLElement): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>('a[href]')];
}

function chipFor(root: HTMLElement, key: string, lang: Lang = 'en'): HTMLAnchorElement {
	const href = regionHref(lang)(key);
	const chip = chipLinks(root).find((a) => a.getAttribute('href') === href);
	expect(chip, `got no chip linking to ${href}`).toBeDefined();
	return chip!;
}

const textOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// A Chip primitive rendered beside the row, as the filter bar shows it.
async function referenceChip(pressed: boolean): Promise<HTMLElement> {
	const Chip = await loadUi<ChipProps>('Chip');
	const host = stage();
	await render(Chip, { target: host, props: { label: 'Galicia', pressed, onToggle: () => {} } });
	return host.querySelector<HTMLElement>('button')!;
}

function expectSameStyle(got: Element, want: Element, properties: string[], what: string) {
	for (const property of properties) {
		expect(style(got, property), `${what} ${property}`).toBe(style(want, property));
	}
}

// Every chip click inside `target`, by href; the navigation is cancelled.
function recordClicks(target: HTMLElement): string[] {
	const hrefs: string[] = [];
	target.addEventListener('click', (event) => {
		const link = (event.target as Element).closest('a');
		if (!link) return;
		event.preventDefault();
		hrefs.push(link.getAttribute('href') ?? '');
	});
	return hrefs;
}

describe('RegionChips content', () => {
	useViewport(390, 844);

	for (const lang of ['en', 'es', 'ru'] as const) {
		it(`links every region, in the order given, labelled by its name (${lang})`, async () => {
			const root = await renderChips({ lang });
			const got = chipLinks(root).map((a) => ({ href: a.getAttribute('href'), text: textOf(a) }));
			const want = regionsIn(lang).map((r) => ({ href: regionHref(lang)(r.key), text: r.name }));
			expect(got).toEqual(want);
		});
	}

	it('has no "all" chip and no other control: one link per region', async () => {
		const root = await renderChips();
		const controls = root.querySelectorAll('a, button, input, [tabindex]');
		expect(controls.length, `got ${controls.length} controls`).toBe(regionsIn('en').length);
	});

	it('marks only the selected region’s chip with aria-current="true"', async () => {
		const root = await renderChips({ selectedKey: 'rio' });
		const current = chipLinks(root).filter((a) => a.getAttribute('aria-current') === 'true');
		expect(current.map((a) => a.getAttribute('href'))).toEqual([regionHref('en')('rio')]);
		const marked = chipLinks(root).filter((a) => a.hasAttribute('aria-current'));
		expect(marked, 'got aria-current on an unselected chip').toHaveLength(1);
	});

	it('marks no chip with no region selected', async () => {
		const root = await renderChips();
		const marked = chipLinks(root).filter((a) => a.hasAttribute('aria-current'));
		expect(marked, 'got a chip marked with nothing selected').toEqual([]);
	});

	it('carries no aria-pressed (a link, not a toggle button)', async () => {
		const root = await renderChips({ selectedKey: 'gal' });
		const pressed = chipLinks(root).filter((a) => a.hasAttribute('aria-pressed'));
		expect(pressed, 'got aria-pressed on a link').toEqual([]);
	});
});

describe('RegionChips activation', () => {
	useViewport(390, 844);

	it('follows the chip’s region URL on a click, as the map region does', async () => {
		const target = stage(`width: ${MOBILE_CONTENT_WIDTH_PX}px`);
		const hrefs = recordClicks(target);
		const root = await renderChips({}, target);
		await userEvent.click(chipFor(root, 'and'));
		await userEvent.click(chipFor(root, 'rio'));
		expect(hrefs).toEqual([regionHref('en')('and'), regionHref('en')('rio')]);
	});

	it('tells onActivate the region key before the link is followed', async () => {
		const RegionChips = await loadContent<RegionChipsProps>('RegionChips');
		const target = stage(`width: ${MOBILE_CONTENT_WIDTH_PX}px`);
		recordClicks(target);
		const heard: string[] = [];
		const props: RegionChipsProps = {
			regions: regionsIn('en'),
			hrefFor: regionHref('en'),
			onActivate: (key) => heard.push(key)
		};
		await render(RegionChips, { target, props });
		const root = page.getByTestId(TEST_ID).element() as HTMLElement;
		await userEvent.click(chipFor(root, 'cnb'));
		expect(heard).toEqual(['cnb']);
	});

	it('activates the focused chip on Enter', async () => {
		const target = stage(`width: ${MOBILE_CONTENT_WIDTH_PX}px`);
		const hrefs = recordClicks(target);
		const root = await renderChips({}, target);
		chipFor(root, 'nav').focus();
		await userEvent.keyboard('{Enter}');
		expect(hrefs).toEqual([regionHref('en')('nav')]);
	});
});

describe('RegionChips row', () => {
	useViewport(390, 844);

	it('is one row that never wraps and scrolls sideways', async () => {
		const root = await renderChips();
		const links = chipLinks(root);
		const row = links[0].parentElement!;
		expect(style(row, 'flex-wrap')).toBe('nowrap');
		expect(style(row, 'overflow-x')).toBe('auto');
		const tops = new Set(links.map((a) => Math.round(a.getBoundingClientRect().top)));
		expect(tops.size, `got chips on ${tops.size} lines`).toBe(1);
		expect(row.scrollWidth, 'want the 17 chips to overflow the phone width').toBeGreaterThan(
			row.clientWidth
		);
	});

	for (const width of [MOBILE_CONTENT_WIDTH_PX, NARROW_CONTENT_WIDTH_PX]) {
		it(`never truncates or wraps a Russian name (${width}px)`, async () => {
			const root = await renderChips({ lang: 'ru', width });
			for (const region of regionsIn('ru')) {
				const chip = chipFor(root, region.key, 'ru');
				chip.scrollIntoView({ inline: 'center' });
				// typeset may bind short words with no-break spaces, so the name
				// is compared with whitespace folded.
				expect(textOf(chip)).toBe(region.name);
				expectFullyVisible(chip, chip.textContent?.trim() ?? '');
				expect(textLineCount(chip), `got ${region.name} on several lines`).toBe(1);
			}
		});
	}

	it(`gives every chip a hit area of at least ${HIT_MIN_PX}×${HIT_MIN_PX}px`, async () => {
		const root = await renderChips();
		for (const chip of chipLinks(root)) {
			// Scrolled into the row's view, so presses can be sampled on screen.
			chip.scrollIntoView({ inline: 'center', block: 'nearest' });
			const { width, height } = hitArea(chip);
			const what = `${textOf(chip)} hit area ${width}×${height}`;
			expect(width, what).toBeGreaterThanOrEqual(HIT_MIN_PX - PX_TOLERANCE);
			expect(height, what).toBeGreaterThanOrEqual(HIT_MIN_PX - PX_TOLERANCE);
		}
	});
});

describe('RegionChips look (the Popular filter bar’s chips)', () => {
	useViewport(390, 844);

	it('draws each chip with the Chip primitive’s box and type', async () => {
		const reference = await referenceChip(false);
		const root = await renderChips();
		for (const chip of chipLinks(root)) expectSameStyle(chip, reference, CHIP_LOOK, textOf(chip));
	});

	it('draws an unselected chip in the Chip’s off colours', async () => {
		const reference = await referenceChip(false);
		const root = await renderChips({ selectedKey: 'gal' });
		expectSameStyle(chipFor(root, 'ast'), reference, CHIP_COLOURS, 'Asturias');
	});

	it('draws the selected chip in the Chip’s active (pressed) colours', async () => {
		const reference = await referenceChip(true);
		const root = await renderChips({ selectedKey: 'gal' });
		const chip = chipFor(root, 'gal');
		await expect
			.poll(() => style(chip, 'background-color'))
			.toBe(style(reference, 'background-color'));
		expectSameStyle(chip, reference, CHIP_COLOURS, 'Galicia');
	});

	it('has no underline (a chip, not a text link)', async () => {
		const root = await renderChips();
		expect(style(chipLinks(root)[0], 'text-decoration-line')).toBe('none');
	});
});
