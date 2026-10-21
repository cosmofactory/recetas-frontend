import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { Lang } from '../../testutil/map';
import {
	dishesCookedIn,
	dishesIn,
	recipeHrefIn,
	REGION_DETAILS_TEST_ID,
	regionIn,
	type Dish,
	type RegionDetailsProps
} from '../../testutil/region';
import {
	computed,
	loadContent,
	stage,
	style,
	ungatedHoverRules,
	useViewport
} from '../../testutil/ui';

// FE-4 PR 3, RegionDetails: the region sheet (mobile, inside BottomSheet)
// and the region panel (desktop, inside StickyPanel) content. A content
// component (src/lib/content/): data and callbacks only, never a container.
//
// Sources, by line:
// - Mobile README -> Regional tab — Region sheet L73–79: "Content (padding
//   4px 22px 22px, column, gap 14px): Title row: region name, Instrument
//   Serif 34px. Description: 12.5px, ink-2, line-height 1.45, margin-top
//   −8px. Regional dish chips: wrap, gap 8px; each padding 7px 12px, 1px
//   --border-field, pill, 12px/500. Divider (1px rgba(43,30,22,.12)), then a
//   dish list ... Row: padding 11px 0, hairline bottom border, flex row gap
//   12px, centred: 52×52 photo, radius 10px. Column, gap 3px: variation name
//   (Instrument Serif 19px) and its description (11.5px ink-2, lh 1.35)."
//   L79: no "regional guide" button, recipe counts or "signature dish" card.
//   L169: "Region sheet count shows the region's number of variations ("5
//   variations"), not recipes." Plurals via CLDR (L164).
// - Mobile prototype (Asadorov Explorations.dc.html, 2a) L378–401: the title
//   row is "display:flex;align-items:baseline;justify-content:space-between"
//   with the count "font-size:12px;color:#C4552E;font-weight:600"; the chips
//   are plain <div>s with no handler (labels, not toggles); the list has
//   "border-top:1px solid rgba(43,30,22,.12);padding-top:6px"; a row's name
//   has line-height 1.15; there is no chevron and no row hover.
// - Desktop README -> Regional L56: "Region name 46px serif + "N
//   variations"; description 15px; regional dish chips; list rows (64px
//   thumb, 22px serif name, 13.5px description, chevron, hover
//   --bg-surface-muted). Clicking a row opens that variation's recipe."
//   Desktop prototype (Asadorov Desktop.dc.html) L110–132: content
//   "gap:16px" (the panel's padding is StickyPanel's); title row baseline,
//   space-between, gap 16px; name line-height 1.02; count "13px/700
//   #C4552E, nowrap"; description "color:rgba(43,30,22,.62);
//   line-height:1.55"; chips "padding:7px 13px ... font-size:12.5px;
//   font-weight:500"; list "border-top ... .12; padding-top:8px"; row
//   "gap:16px; padding:12px 10px; border-radius:14px", hover #F3EBDA
//   (= --bg-surface-muted); thumb 64×64 radius 12px; text column gap 4px,
//   name lh 1.15, description rgba(43,30,22,.6) (= --ink-2) lh 1.4; chevron
//   "›" 20px rgba(43,30,22,.35).
//
// Contrast (stack.md X10 "Contrast overrides", owner 2026-10-21): text
// colours below AA use the layout.css overrides, so the count is
// --accent-text (not --accent) and the desktop description, .62 in the
// prototype (4.496:1, under AA), is --ink-2 (.64).
//
// Decisions pinned here (FE-4 PR 3 report):
// - Props: { region, dishes, recipeHref(dishKey, regionKey), mediaBaseUrl };
//   the rows come from regionVariations(region.key, dishes)
//   (#lib/content/region-variations.ts). The root carries
//   data-testid="region-details".
// - The region name is the content's one heading, an <h2>: the page's <h1>
//   is the mobile logo / the desktop "How Spain really cooks" title, both
//   always in the HTML, so a region <h1> would make two visible h1s.
// - Chips are non-interactive labels (the prototype gives them no handler):
//   not the filter Chip toggle, nothing focusable, no pressed state.
// - Each row is ONE link (the link is the row box: padding, gap, border,
//   hover) to recipeHref(dishKey, region.key), holding the photo, name and
//   description; the only focusable things in the content are those links.
// - The photo is the variation's `thumb`, decorative (alt ""): the row's
//   name is its text.
// - The chevron is desktop only (an aria-hidden icon), absent on mobile.

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const INTERACTIVE_ROLES = '[role="button"], [role="checkbox"], [role="switch"], [aria-pressed]';
const PHOTO = 'picture, [class~="placeholder"]';
const MEDIA = 'https://media.invalid';

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

function useLocale(lang: Lang) {
	overwriteGetLocale(() => lang);
}

type RenderSpec = {
	lang?: Lang;
	regionKey?: string;
	dishes?: Dish[];
	mediaBaseUrl?: string;
	width?: number;
};

async function renderDetails(spec: RenderSpec = {}): Promise<HTMLElement> {
	const lang = spec.lang ?? 'en';
	useLocale(lang);
	const RegionDetails = await loadContent<RegionDetailsProps>('RegionDetails');
	const target = stage(`width: ${spec.width ?? 390}px; background: var(--bg-surface)`);
	const props: RegionDetailsProps = {
		region: regionIn(lang, spec.regionKey ?? 'gal'),
		dishes: spec.dishes ?? dishesIn(lang),
		recipeHref: recipeHrefIn(lang),
		mediaBaseUrl: spec.mediaBaseUrl
	};
	render(RegionDetails, { target, props });
	const root = target.querySelector<HTMLElement>(`[data-testid="${REGION_DETAILS_TEST_ID}"]`);
	expect(root, `got no [data-testid="${REGION_DETAILS_TEST_ID}"] root`).not.toBeNull();
	return root!;
}

// The deepest element whose whole text is `text`.
function textElement(root: Element, text: string): HTMLElement {
	const all = [...root.querySelectorAll<HTMLElement>('*')].filter(
		(el) => el.textContent?.trim() === text
	);
	const leaf = all.find((el) => !all.some((other) => other !== el && el.contains(other)));
	expect(leaf, `got no element with the text "${text}"`).toBeDefined();
	return leaf!;
}

function rowLinks(root: Element): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>('a[href]')];
}

function photoIn(link: Element): HTMLElement {
	const photo = link.querySelector<HTMLElement>(PHOTO);
	expect(photo, `got no photo in the row ${link.getAttribute('href')}`).not.toBeNull();
	return photo!;
}

function px(el: Element, property: string): number {
	return parseFloat(style(el, property));
}

function expectPx(got: number, want: number, what: string) {
	expect(Math.abs(got - want), `got ${what} ${got}px, want ${want}px`).toBeLessThanOrEqual(0.5);
}

const isShown = (el: Element) => (el as HTMLElement).getClientRects().length > 0;

// Galicia in the vendored bundle: its dishes in dish order.
const GALICIA_ROWS: Record<'en' | 'ru', { dishKey: string; name: string; description: string }[]> =
	{
		en: [
			{
				dishKey: 'tortilla',
				name: 'Betanzos-style runny',
				description: 'Barely-set centre, no onion, eaten with bread'
			},
			{
				dishKey: 'cocido',
				name: 'Cocido gallego',
				description: 'Grelos, pork shoulder and cachelos'
			},
			{
				dishKey: 'croquetas',
				name: 'De marisco',
				description: 'Built on leftover shellfish stock'
			},
			{
				dishKey: 'torrijas',
				name: 'Filloas',
				description: 'Thin crêpes, sometimes made with broth'
			}
		],
		ru: [
			{
				dishKey: 'tortilla',
				name: 'По-бетансосски, жидкая внутри',
				description: 'Едва схваченная серединка, без лука, едят с хлебом'
			},
			{
				dishKey: 'cocido',
				name: 'Cocido gallego',
				description: 'Грелос, свиная лопатка и отварной картофель'
			},
			{ dishKey: 'croquetas', name: 'De marisco', description: 'На бульоне от морепродуктов' },
			{ dishKey: 'torrijas', name: 'Filloas', description: 'Тонкие блинчики, иногда на бульоне' }
		]
	};

describe('RegionDetails: name, description and regional dishes', () => {
	for (const lang of ['en', 'ru'] as const) {
		it(`shows the ${lang} region name as the one <h2>`, async () => {
			const root = await renderDetails({ lang });
			const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')];
			expect(
				headings.map((h) => h.tagName),
				'want exactly one heading, an <h2>'
			).toEqual(['H2']);
			expect(headings[0].textContent?.trim()).toBe(regionIn(lang, 'gal').name);
		});

		it(`shows the ${lang} description`, async () => {
			const root = await renderDetails({ lang });
			textElement(root, regionIn(lang, 'gal').description);
		});
	}

	it('shows each regional dish as a chip, in order, with its Spanish name', async () => {
		const root = await renderDetails({ lang: 'ru' });
		const names = ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos'];
		const chips = names.map((name) => textElement(root, name));
		for (let i = 1; i < chips.length; i++) {
			const follows = chips[i - 1].compareDocumentPosition(chips[i]);
			expect(follows & Node.DOCUMENT_POSITION_FOLLOWING, `got "${names[i]}" out of order`).toBe(
				Node.DOCUMENT_POSITION_FOLLOWING
			);
		}
	});

	it('chips are plain labels: not links, buttons or toggles', async () => {
		const root = await renderDetails();
		for (const name of regionIn('en', 'gal').regionalDishes) {
			const chip = textElement(root, name);
			expect(chip.closest(FOCUSABLE), `got "${name}" inside a focusable element`).toBeNull();
			expect(chip.closest(INTERACTIVE_ROLES), `got "${name}" with a toggle role`).toBeNull();
		}
	});

	it('has no focusable element but the row links', async () => {
		const root = await renderDetails();
		const focusable = [...root.querySelectorAll(FOCUSABLE)];
		const links = rowLinks(root);
		expect(
			focusable.length,
			`got ${focusable.length} focusable, want the ${links.length} rows`
		).toBe(links.length);
		expect(root.querySelectorAll(INTERACTIVE_ROLES).length, 'got a toggle in the content').toBe(0);
	});
});

describe('RegionDetails: the variation count (ICU plural home.variation)', () => {
	it('counts Galicia\'s 4 variations: "4 variations"', async () => {
		const root = await renderDetails();
		textElement(root, '4 variations');
	});

	it('counts Andalucía\'s 6 variations: "6 variations"', async () => {
		const root = await renderDetails({ regionKey: 'and' });
		textElement(root, '6 variations');
	});

	const cases: { lang: Lang; count: number; want: string }[] = [
		{ lang: 'en', count: 1, want: '1 variation' },
		{ lang: 'en', count: 2, want: '2 variations' },
		{ lang: 'en', count: 5, want: '5 variations' },
		{ lang: 'es', count: 1, want: '1 variante' },
		{ lang: 'es', count: 2, want: '2 variantes' },
		{ lang: 'es', count: 5, want: '5 variantes' },
		{ lang: 'ru', count: 1, want: '1 вариант' },
		{ lang: 'ru', count: 2, want: '2 варианта' },
		{ lang: 'ru', count: 5, want: '5 вариантов' }
	];
	for (const tc of cases) {
		it(`${tc.lang}: ${tc.count} → "${tc.want}"`, async () => {
			const root = await renderDetails({
				lang: tc.lang,
				dishes: dishesCookedIn('gal', tc.count, tc.lang)
			});
			textElement(root, tc.want);
			expect(rowLinks(root).length, `want one row per variation`).toBe(tc.count);
		});
	}

	it('shows "0 variations" and no rows when no dish is cooked there', async () => {
		const root = await renderDetails({ dishes: dishesCookedIn('ast', 3) });
		textElement(root, '0 variations');
		expect(rowLinks(root).length, 'got rows for another region').toBe(0);
	});
});

describe('RegionDetails: the dish list', () => {
	for (const lang of ['en', 'ru'] as const) {
		it(`${lang}: one link per Galicia variation, in dish order, to its recipe`, async () => {
			const root = await renderDetails({ lang });
			const want = GALICIA_ROWS[lang];
			const hrefs = rowLinks(root).map((a) => a.getAttribute('href'));
			expect(hrefs).toEqual(want.map((row) => `/${lang}/dishes/${row.dishKey}/gal`));
		});

		it(`${lang}: each row shows the variation name and its description`, async () => {
			const root = await renderDetails({ lang });
			const links = rowLinks(root);
			GALICIA_ROWS[lang].forEach((row, i) => {
				const link = links[i];
				expect(link, `got no row ${i + 1}`).toBeDefined();
				textElement(link, row.name);
				textElement(link, row.description);
			});
		});
	}

	it('the whole row is one link: photo, name and description inside it', async () => {
		const root = await renderDetails();
		for (const link of rowLinks(root)) {
			photoIn(link);
			expect(link.querySelector('a'), 'got a link nested in a row').toBeNull();
		}
	});

	it('the photo is decorative: the row is named by its text', async () => {
		const root = await renderDetails({ mediaBaseUrl: MEDIA, dishes: withThumbs(dishesIn('en')) });
		const [first] = rowLinks(root);
		const img = first.querySelector('img');
		expect(img, 'got no <img> with a media base URL and a thumb').not.toBeNull();
		expect(img!.getAttribute('alt'), 'want alt="" on the row photo').toBe('');
	});

	it("uses the variation's thumb photo", async () => {
		const root = await renderDetails({ mediaBaseUrl: MEDIA, dishes: withThumbs(dishesIn('en')) });
		const [first] = rowLinks(root);
		const src = first.querySelector('img')?.getAttribute('src') ?? '';
		expect(src, `got src ${src}`).toContain(`${MEDIA}/dishes/tortilla/gal/thumb-1`);
	});

	it('draws the placeholder when there is no photo', async () => {
		const root = await renderDetails();
		for (const link of rowLinks(root)) {
			expect(link.querySelector('img'), 'got an <img> without a photo').toBeNull();
			photoIn(link);
		}
	});
});

// Every variation gets a thumb (and a card and hero, which must not be used).
function withThumbs(dishes: Dish[]): Dish[] {
	return dishes.map((dish) => ({
		...dish,
		variations: dish.variations.map((v) => ({
			...v,
			photos: {
				thumb: `dishes/${dish.key}/${v.regionKey}/thumb-1`,
				card: `dishes/${dish.key}/${v.regionKey}/card-1`,
				hero: `dishes/${dish.key}/${v.regionKey}/hero-1`
			}
		}))
	}));
}

describe('RegionDetails: mobile sheet styles (< 860px)', () => {
	useViewport(390, 844);

	it('content: padding 4px 22px 22px, column, gap 14px', async () => {
		const root = await renderDetails();
		expect(style(root, 'display')).toBe('flex');
		expect(style(root, 'flex-direction')).toBe('column');
		expect(style(root, 'row-gap')).toBe('14px');
		expect(style(root, 'padding')).toBe('4px 22px 22px');
	});

	it('title row: name 34px Instrument Serif, count 12px/600 --accent-text on its baseline', async () => {
		const root = await renderDetails();
		const name = root.querySelector('h2')!;
		const count = textElement(root, '4 variations');
		expect(style(name, 'font-size')).toBe('34px');
		expect(style(name, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expect(style(count, 'font-size')).toBe('12px');
		expect(style(count, 'font-weight')).toBe('600');
		expect(style(count, 'color')).toBe(computed('color', 'var(--accent-text)'));
		const row = name.parentElement!;
		expect(row.contains(count), 'want the count in the name row').toBe(true);
		expect(style(row, 'display')).toBe('flex');
		expect(style(row, 'align-items')).toBe('baseline');
		expect(style(row, 'justify-content')).toBe('space-between');
	});

	it('description: 12.5px ink-2, line-height 1.45, margin-top −8px', async () => {
		const root = await renderDetails();
		const description = textElement(root, regionIn('en', 'gal').description);
		expect(style(description, 'font-size')).toBe('12.5px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 12.5 * 1.45, 'description line-height');
		expect(style(description, 'margin-top')).toBe('-8px');
	});

	it('chips: wrap, gap 8px; padding 7px 12px, 1px --border-field, pill, 12px/500', async () => {
		const root = await renderDetails();
		const chip = textElement(root, 'Pulpo á feira');
		const chipRow = commonAncestor(chip, textElement(root, 'Empanada gallega'));
		expect(style(chipRow, 'flex-wrap')).toBe('wrap');
		expect(style(chipRow, 'column-gap')).toBe('8px');
		expect(style(chipRow, 'row-gap')).toBe('8px');
		expect(style(chip, 'padding')).toBe('7px 12px');
		expect(style(chip, 'border-top-width')).toBe('1px');
		expect(style(chip, 'border-top-style')).toBe('solid');
		expect(style(chip, 'border-top-color')).toBe(computed('color', 'var(--border-field)'));
		expect(style(chip, 'border-top-left-radius')).toBe(
			computed('border-top-left-radius', 'var(--radius-pill)')
		);
		expect(style(chip, 'font-size')).toBe('12px');
		expect(style(chip, 'font-weight')).toBe('500');
	});

	it('the dish list starts with a 1px rgba(43,30,22,.12) divider, padding-top 6px', async () => {
		const root = await renderDetails();
		const list = listOf(root);
		expect(style(list, 'border-top-width')).toBe('1px');
		expect(style(list, 'border-top-color')).toBe(computed('color', 'rgba(43,30,22,.12)'));
		expect(style(list, 'padding-top')).toBe('6px');
	});

	it('row: padding 11px 0, hairline bottom border, flex gap 12px, centred', async () => {
		const root = await renderDetails();
		const [row] = rowLinks(root);
		expect(style(row, 'display')).toBe('flex');
		expect(style(row, 'align-items')).toBe('center');
		expect(style(row, 'column-gap')).toBe('12px');
		expect(style(row, 'padding')).toBe('11px 0px');
		expect(style(row, 'border-bottom-width')).toBe('1px');
		expect(style(row, 'border-bottom-color')).toBe(computed('color', 'var(--border-hairline)'));
	});

	it('row photo: 52×52, radius 10px', async () => {
		const root = await renderDetails();
		const photo = photoIn(rowLinks(root)[0]);
		const box = photo.getBoundingClientRect();
		expectPx(box.width, 52, 'photo width');
		expectPx(box.height, 52, 'photo height');
		expect(style(photo, 'border-top-left-radius')).toBe('10px');
	});

	it('row text: name 19px serif lh 1.15, description 11.5px ink-2 lh 1.35, gap 3px', async () => {
		const root = await renderDetails();
		const [row] = rowLinks(root);
		const name = textElement(row, GALICIA_ROWS.en[0].name);
		const description = textElement(row, GALICIA_ROWS.en[0].description);
		expect(style(name, 'font-size')).toBe('19px');
		expect(style(name, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expectPx(px(name, 'line-height'), 19 * 1.15, 'name line-height');
		expect(style(description, 'font-size')).toBe('11.5px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 11.5 * 1.35, 'description line-height');
		expect(style(name.parentElement!, 'row-gap')).toBe('3px');
	});

	it('rows have no chevron on mobile', async () => {
		const root = await renderDetails();
		for (const row of rowLinks(root)) {
			const shown = [...row.querySelectorAll('svg')].filter(isShown);
			expect(shown.length, `got a visible icon in ${row.getAttribute('href')}`).toBe(0);
		}
	});
});

function commonAncestor(a: Element, b: Element): HTMLElement {
	let node: HTMLElement | null = a.parentElement;
	while (node && !node.contains(b)) node = node.parentElement;
	expect(node, 'got no common ancestor').not.toBeNull();
	return node!;
}

// The list the rows sit in: the closest common ancestor of the row links.
function listOf(root: HTMLElement): HTMLElement {
	const [first, second] = rowLinks(root);
	return commonAncestor(first, second);
}

describe('RegionDetails: desktop panel styles (≥ 860px)', () => {
	useViewport(1280, 800);

	it('content: column, gap 16px, no padding of its own (the panel pads)', async () => {
		const root = await renderDetails({ width: 460 });
		expect(style(root, 'flex-direction')).toBe('column');
		expect(style(root, 'row-gap')).toBe('16px');
		expect(style(root, 'padding')).toBe('0px');
	});

	it('title row: name 46px serif lh 1.02, count 13px/700 --accent-text, nowrap, gap 16px', async () => {
		const root = await renderDetails({ width: 460 });
		const name = root.querySelector('h2')!;
		const count = textElement(root, '4 variations');
		expect(style(name, 'font-size')).toBe('46px');
		expect(style(name, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expectPx(px(name, 'line-height'), 46 * 1.02, 'name line-height');
		expect(style(count, 'font-size')).toBe('13px');
		expect(style(count, 'font-weight')).toBe('700');
		expect(style(count, 'color')).toBe(computed('color', 'var(--accent-text)'));
		expect(style(count, 'white-space')).toBe('nowrap');
		expect(style(name.parentElement!, 'column-gap')).toBe('16px');
		expect(style(name.parentElement!, 'align-items')).toBe('baseline');
	});

	it('description: 15px, --ink-2 (AA override of the prototype .62), line-height 1.55', async () => {
		const root = await renderDetails({ width: 460 });
		const description = textElement(root, regionIn('en', 'gal').description);
		expect(style(description, 'font-size')).toBe('15px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 15 * 1.55, 'description line-height');
		expect(style(description, 'margin-top')).toBe('0px');
	});

	it('chips: padding 7px 13px, 12.5px/500', async () => {
		const root = await renderDetails({ width: 460 });
		const chip = textElement(root, 'Pulpo á feira');
		expect(style(chip, 'padding')).toBe('7px 13px');
		expect(style(chip, 'font-size')).toBe('12.5px');
		expect(style(chip, 'font-weight')).toBe('500');
	});

	it('the dish list: .12 divider, padding-top 8px', async () => {
		const root = await renderDetails({ width: 460 });
		const list = listOf(root);
		expect(style(list, 'border-top-color')).toBe(computed('color', 'rgba(43,30,22,.12)'));
		expect(style(list, 'padding-top')).toBe('8px');
	});

	it('row: padding 12px 10px, radius 14px, gap 16px, no bottom border', async () => {
		const root = await renderDetails({ width: 460 });
		const [row] = rowLinks(root);
		expect(style(row, 'padding')).toBe('12px 10px');
		expect(style(row, 'border-top-left-radius')).toBe('14px');
		expect(style(row, 'column-gap')).toBe('16px');
		expect(style(row, 'border-bottom-width')).toBe('0px');
	});

	it('row thumb: 64×64, radius 12px', async () => {
		const root = await renderDetails({ width: 460 });
		const photo = photoIn(rowLinks(root)[0]);
		const box = photo.getBoundingClientRect();
		expectPx(box.width, 64, 'thumb width');
		expectPx(box.height, 64, 'thumb height');
		expect(style(photo, 'border-top-left-radius')).toBe('12px');
	});

	it('row text: name 22px serif lh 1.15, description 13.5px ink-2 lh 1.4, gap 4px', async () => {
		const root = await renderDetails({ width: 460 });
		const [row] = rowLinks(root);
		const name = textElement(row, GALICIA_ROWS.en[0].name);
		const description = textElement(row, GALICIA_ROWS.en[0].description);
		expect(style(name, 'font-size')).toBe('22px');
		expectPx(px(name, 'line-height'), 22 * 1.15, 'name line-height');
		expect(style(description, 'font-size')).toBe('13.5px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 13.5 * 1.4, 'description line-height');
		expect(style(name.parentElement!, 'row-gap')).toBe('4px');
	});

	it('each row ends with a visible, aria-hidden chevron in rgba(43,30,22,.35)', async () => {
		const root = await renderDetails({ width: 460 });
		for (const row of rowLinks(root)) {
			const icons = [...row.querySelectorAll('svg')].filter(isShown);
			expect(icons.length, `got ${icons.length} visible icons in a row, want 1`).toBe(1);
			const icon = icons[0];
			expect(icon.closest('[aria-hidden="true"]'), 'want the chevron aria-hidden').not.toBeNull();
			expect(style(icon, 'color')).toBe(computed('color', 'rgba(43,30,22,.35)'));
			const rowBox = row.getBoundingClientRect();
			const iconBox = icon.getBoundingClientRect();
			expect(rowBox.right - iconBox.right, 'want the chevron at the row end').toBeLessThan(16);
		}
	});

	it('row hover: --bg-surface-muted, only under (hover: hover)', async () => {
		const root = await renderDetails({ width: 460 });
		const [row] = rowLinks(root);
		await userEvent.hover(row);
		await expect
			.poll(() => style(row, 'background-color'))
			.toBe(computed('background-color', 'var(--bg-surface-muted)'));
		expect(ungatedHoverRules(row), 'got :hover rules outside @media (hover: hover)').toEqual([]);
	});
});
