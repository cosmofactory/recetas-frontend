import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { localizedHref } from '#lib/i18n/localized-href.ts';
import {
	dishIn,
	dishWithVariations,
	type Dish,
	type DishDetailsProps
} from '../../testutil/popular';
import {
	NOT_THE_GLOSSARY,
	POPULAR_LOCALES,
	SHEET_COPY,
	TEST_IDS,
	VARIATION_REGIONS,
	type PopularLocale
} from '../../testutil/popular-copy';
import { scrollerOf } from '../../testutil/sheet';
import {
	computed,
	loadContent,
	stage,
	style,
	textContrast,
	textElement,
	ungatedHoverRules,
	useViewport
} from '../../testutil/ui';

// FE-5 PR 2, DishDetails: the mobile dish detail sheet's content (D-FE5-2:
// the sheet opens from ?tab=popular&dish=<key>). A content component
// (src/lib/content/): data and callbacks only, never a container; the
// screen wraps it in BottomSheet.
//
// Sources, by line:
// - Mobile README -> Popular tab — Dish detail sheet L95–100: "Same sheet
//   shell and states as the region sheet. Content (gap 12px): Row: dish
//   name (Instrument Serif 27px, lh 1.05) + "N variations" (11.5px/700,
//   accent). Description (12.5px, ink-2). Variation list (max-height 200px,
//   scrolls, scrollbar hidden). Row: padding 10px 8px, hairline bottom
//   border, radius 8px, gap 10px: 42px thumb (radius 8px); column with name
//   (13.5px/600) + region (10.5px, ink-4) on one baseline row, and the
//   description below (11px ink-2). No counts, no highlighted row. Primary
//   button "See all variations" — accent bg, --on-accent text, radius 14px,
//   padding 15px, 14px/600, hover --accent-hover. → Variations page."
// - Mobile prototype (Asadorov Explorations.dc.html, 2a) L357–375: content
//   "padding:4px 22px 22px;...gap:12px"; title row "align-items:baseline;
//   justify-content:space-between;gap:10px", count nowrap; description
//   "line-height:1.45;margin-top:-4px"; row "align-items:center"; text
//   column gap 2px, name/region row "align-items:baseline;gap:7px";
//   description lh 1.35. The prototype sorts the rows by recipe count and
//   tints the last-picked row: both are what the README removes ("No
//   counts, no highlighted row"), and CLAUDE.md: "All variations of a dish
//   are equal and ordered by region order".
// - Both READMEs -> Data model: "Order them by region order in the data";
//   the API sends Dish.variations in region order (openapi.yaml), so the
//   content keeps the order it is given (paella: bundle order val, cat, …,
//   region order cat, ara, val, …).
// - Contrast (stack.md X10): the count is accent text (--accent-text); ink-4
//   (.45) misses AA for 10.5px text, so the region needs an AA colour.
//
// Decisions pinned here (FE-5 PR 2):
// - src/lib/content/DishDetails.svelte, props { dish, variationsHref,
//   recipeHref, mediaBaseUrl }; root data-testid="dish-details".
// - The dish name is the content's one heading, an <h2> (as RegionDetails:
//   the page's <h1> stays the logo).
// - Assumption (the README gives rows no target): each variation row is ONE
//   link to its recipe, recipeHref(dish.key, regionKey), like the region
//   sheet's rows; the thumb is the variation's `thumb` photo, decorative.
// - The region shown in a row is the full region name (as the card preview).
// - "See all variations" is the PrimaryButton link (regular size) to
//   variationsHref, after the list. The only focusable elements are the
//   row links and that link.

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const PHOTO = 'picture, [class~="placeholder"]';
const MEDIA = 'https://media.invalid';
// The mobile sheet's width at the design size.
const SHEET_WIDTH_PX = 390;
const MIN_TEXT_CONTRAST = 4.5;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

type RenderSpec = { lang?: PopularLocale; dish?: Dish; mediaBaseUrl?: string };

const variationsHrefFor = (lang: PopularLocale, dishKey: string) =>
	localizedHref(`/dishes/${dishKey}`, lang);

const recipeHrefIn =
	(lang: PopularLocale): DishDetailsProps['recipeHref'] =>
	(dishKey, regionKey) =>
		localizedHref(`/dishes/${dishKey}/${regionKey}`, lang);

async function renderDetails(spec: RenderSpec = {}): Promise<HTMLElement> {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const DishDetails = await loadContent<DishDetailsProps>('DishDetails');
	const target = stage(`width: ${SHEET_WIDTH_PX}px; background: var(--bg-surface)`);
	const dish = spec.dish ?? dishIn(lang, 'tortilla');
	const props: DishDetailsProps = {
		dish,
		variationsHref: variationsHrefFor(lang, dish.key),
		recipeHref: recipeHrefIn(lang),
		mediaBaseUrl: spec.mediaBaseUrl
	};
	render(DishDetails, { target, props });
	const root = target.querySelector<HTMLElement>(`[data-testid="${TEST_IDS.dishDetails}"]`);
	expect(root, `got no [data-testid="${TEST_IDS.dishDetails}"] root`).not.toBeNull();
	return root!;
}

const squashed = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, '');

// The variation rows: links into a recipe (/:lang/dishes/:dish/:region).
function rowLinks(root: Element): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) =>
		/\/dishes\/[^/]+\/[^/]+$/.test(a.getAttribute('href') ?? '')
	);
}

function seeAllLink(root: Element, lang: PopularLocale): HTMLAnchorElement {
	const label = SHEET_COPY[lang].seeAll;
	const link = [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
		(a) => a.textContent?.trim() === label
	);
	expect(link, `got no "${label}" link`).toBeDefined();
	return link!;
}

function photoIn(link: Element): HTMLElement {
	const photo = link.querySelector<HTMLElement>(PHOTO);
	expect(photo, `got no photo in the row ${link.getAttribute('href')}`).not.toBeNull();
	return photo!;
}

const THUMB_PX = 42;
const isThumbSized = (el: Element) => {
	const rect = el.getBoundingClientRect();
	return Math.abs(rect.width - THUMB_PX) <= 0.5 && Math.abs(rect.height - THUMB_PX) <= 0.5;
};

// The photo and its ancestors inside the row that are thumb-sized (42×42):
// the box the row draws its thumb in, wherever the radius is set.
function thumbBoxes(link: Element): HTMLElement[] {
	const boxes: HTMLElement[] = [];
	for (let el: HTMLElement | null = photoIn(link); el && el !== link; el = el.parentElement) {
		if (isThumbSized(el)) boxes.push(el);
	}
	return boxes;
}

function commonAncestor(a: Element, b: Element): HTMLElement {
	let el: HTMLElement | null = a.parentElement;
	while (el && !el.contains(b)) el = el.parentElement;
	expect(el, 'got no common ancestor').not.toBeNull();
	return el!;
}

function px(el: Element, property: string): number {
	return parseFloat(style(el, property));
}

function expectPx(got: number, want: number, what: string) {
	expect(Math.abs(got - want), `got ${what} ${got}px, want ${want}px`).toBeLessThanOrEqual(0.5);
}

function withThumbs(dish: Dish): Dish {
	return {
		...dish,
		variations: dish.variations.map((v) => ({
			...v,
			photos: {
				thumb: `dishes/${dish.key}/${v.regionKey}/thumb-1`,
				card: `dishes/${dish.key}/${v.regionKey}/card-1`,
				hero: `dishes/${dish.key}/${v.regionKey}/hero-1`
			}
		}))
	};
}

describe('DishDetails: name, count and description', () => {
	for (const lang of POPULAR_LOCALES) {
		it(`${lang}: the dish name is the one heading, an <h2>`, async () => {
			const root = await renderDetails({ lang });
			const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')];
			expect(
				headings.map((h) => h.tagName),
				'want exactly one heading, an <h2>'
			).toEqual(['H2']);
			expect(headings[0].textContent?.trim()).toBe(dishIn(lang, 'tortilla').name);
		});

		it(`${lang}: shows the description`, async () => {
			const root = await renderDetails({ lang });
			textElement(root, dishIn(lang, 'tortilla').description);
		});
	}

	const counts: { lang: PopularLocale; count: number; want: string }[] = [
		{ lang: 'en', count: 13, want: '13 variations' },
		{ lang: 'es', count: 13, want: '13 variantes' },
		{ lang: 'ru', count: 13, want: '13 вариантов' },
		{ lang: 'en', count: 1, want: '1 variation' },
		{ lang: 'es', count: 1, want: '1 variante' },
		{ lang: 'ru', count: 1, want: '1 вариант' },
		{ lang: 'ru', count: 2, want: '2 варианта' },
		{ lang: 'ru', count: 5, want: '5 вариантов' }
	];
	for (const tc of counts) {
		it(`${tc.lang}: ${tc.count} variations → "${tc.want}" in the title row`, async () => {
			const dish = dishWithVariations(tc.lang, tc.count);
			const root = await renderDetails({ lang: tc.lang, dish });
			const count = textElement(root, tc.want);
			const heading = root.querySelector('h2')!;
			expect(commonAncestor(count, heading), 'want the count in the name row').not.toBe(root);
			expect(rowLinks(root).length, 'want one row per variation').toBe(tc.count);
		});
	}

	for (const lang of POPULAR_LOCALES) {
		it(`${lang}: the copy says "variations", never versions or recipes`, async () => {
			const root = await renderDetails({ lang });
			expect(root.textContent ?? '').not.toMatch(NOT_THE_GLOSSARY);
		});
	}
});

describe('DishDetails: the variation list', () => {
	for (const lang of POPULAR_LOCALES) {
		it(`${lang}: one link per variation, in the order given, to its recipe`, async () => {
			const dish = dishIn(lang, 'tortilla');
			const root = await renderDetails({ lang, dish });
			const hrefs = rowLinks(root).map((a) => a.getAttribute('href'));
			const want = dish.variations.map((v) => `/${lang}/dishes/tortilla/${v.regionKey}`);
			expect(hrefs).toEqual(want);
		});
	}

	it('paella keeps region order (cat, ara, val, …), not the bundle or count order', async () => {
		const root = await renderDetails({ dish: dishIn('en', 'paella') });
		const regions = rowLinks(root).map((a) => a.getAttribute('href')!.split('/').pop());
		expect(regions).toEqual([...VARIATION_REGIONS.paella]);
	});

	for (const lang of POPULAR_LOCALES) {
		it(`${lang}: each row shows the variation name, the full region name and the description`, async () => {
			const dish = dishIn(lang, 'tortilla');
			const links = rowLinks(await renderDetails({ lang, dish }));
			dish.variations.forEach((variation, i) => {
				const link = links[i];
				expect(link, `got no row ${i + 1}`).toBeDefined();
				textElement(link, variation.name);
				textElement(link, variation.regionName);
				textElement(link, variation.description);
			});
		});
	}

	it('a row shows nothing else: no count, no badge, no recipe number', async () => {
		const dish = dishIn('en', 'tortilla');
		const links = rowLinks(await renderDetails({ dish }));
		dish.variations.forEach((v, i) => {
			const text = links[i].textContent ?? '';
			expect(text, `got a number in row ${i + 1}`).not.toMatch(/\d/);
			expect(squashed(text)).toBe(squashed(v.name + v.regionName + v.description));
		});
	});

	it('no row is highlighted: every row looks the same and none is marked', async () => {
		const links = rowLinks(await renderDetails());
		const look = (a: Element) =>
			['background-color', 'border-bottom-color', 'font-weight', 'color']
				.map((p) => style(a, p))
				.join('|');
		const looks = new Set(links.map(look));
		expect([...looks], 'got rows styled differently').toHaveLength(1);
		const marked = links.filter((a) =>
			['aria-current', 'aria-selected', 'data-selected', 'data-active'].some((attr) =>
				a.hasAttribute(attr)
			)
		);
		expect(marked.length, 'got a row marked as current/selected').toBe(0);
		const names = dishIn('en', 'tortilla').variations.map((v, i) =>
			style(textElement(links[i], v.name), 'font-weight')
		);
		expect(new Set(names).size, 'got a variation name in another weight').toBe(1);
	});

	it('the whole row is one link: photo, name, region and description inside it', async () => {
		const root = await renderDetails();
		for (const link of rowLinks(root)) {
			photoIn(link);
			expect(link.querySelector('a'), 'got a link nested in a row').toBeNull();
		}
	});

	it('uses the variation\'s thumb photo, decorative (alt "")', async () => {
		const dish = withThumbs(dishIn('en', 'tortilla'));
		const [first] = rowLinks(await renderDetails({ dish, mediaBaseUrl: MEDIA }));
		const img = first.querySelector('img');
		expect(img, 'got no <img> with a media base URL and a thumb').not.toBeNull();
		expect(img!.getAttribute('alt')).toBe('');
		expect(img!.getAttribute('src') ?? '').toContain(`${MEDIA}/dishes/tortilla/gal/thumb-1`);
	});

	it('draws the placeholder when there is no photo', async () => {
		for (const link of rowLinks(await renderDetails())) {
			expect(link.querySelector('img'), 'got an <img> without a photo').toBeNull();
			photoIn(link);
		}
	});
});

describe('DishDetails: "See all variations"', () => {
	for (const lang of POPULAR_LOCALES) {
		it(`${lang}: "${SHEET_COPY[lang].seeAll}" links to /${lang}/dishes/tortilla`, async () => {
			const root = await renderDetails({ lang });
			expect(seeAllLink(root, lang).getAttribute('href')).toBe(`/${lang}/dishes/tortilla`);
		});
	}

	it('comes after the variation list', async () => {
		const root = await renderDetails();
		const rows = rowLinks(root);
		const last = rows[rows.length - 1];
		const position = last.compareDocumentPosition(seeAllLink(root, 'en'));
		expect(position & Node.DOCUMENT_POSITION_FOLLOWING, 'want the button after the rows').toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});

	it('the row links and that link are the only focusable elements', async () => {
		const root = await renderDetails();
		const focusable = [...root.querySelectorAll(FOCUSABLE)];
		expect(focusable.length, `got ${focusable.length} focusable`).toBe(rowLinks(root).length + 1);
	});
});

describe('DishDetails: mobile sheet styles (< 860px)', () => {
	useViewport(390, 844);

	it('content: padding 4px 22px 22px, column, gap 12px', async () => {
		const root = await renderDetails();
		expect(style(root, 'display')).toBe('flex');
		expect(style(root, 'flex-direction')).toBe('column');
		expect(style(root, 'row-gap')).toBe('12px');
		expect(style(root, 'padding')).toBe('4px 22px 22px');
	});

	it('title row: name 27px Instrument Serif lh 1.05, count 11.5px/700 --accent-text, baseline', async () => {
		const root = await renderDetails();
		const name = root.querySelector('h2')!;
		const count = textElement(root, '13 variations');
		expect(style(name, 'font-size')).toBe('27px');
		expect(style(name, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expectPx(px(name, 'line-height'), 27 * 1.05, 'name line-height');
		expect(style(count, 'font-size')).toBe('11.5px');
		expect(style(count, 'font-weight')).toBe('700');
		expect(style(count, 'color')).toBe(computed('color', 'var(--accent-text)'));
		expect(style(count, 'white-space')).toBe('nowrap');
		const row = commonAncestor(name, count);
		expect(style(row, 'display')).toBe('flex');
		expect(style(row, 'align-items')).toBe('baseline');
		expect(style(row, 'justify-content')).toBe('space-between');
		expect(style(row, 'column-gap')).toBe('10px');
	});

	it('description: 12.5px ink-2, line-height 1.45, margin-top −4px', async () => {
		const root = await renderDetails();
		const description = textElement(root, dishIn('en', 'tortilla').description);
		expect(style(description, 'font-size')).toBe('12.5px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 12.5 * 1.45, 'description line-height');
		expect(style(description, 'margin-top')).toBe('-4px');
	});

	it('the list scrolls in itself: max-height 200px, scrollbar hidden', async () => {
		const root = await renderDetails();
		const [first] = rowLinks(root);
		const list = scrollerOf(first, root);
		expect(list, 'got the content root scrolling, want the list').not.toBe(root);
		expect(style(list, 'max-height')).toBe('200px');
		expect(style(list, 'scrollbar-width')).toBe('none');
		expect(list.scrollHeight, 'want 13 rows to overflow 200px').toBeGreaterThan(list.clientHeight);
		expect(list.contains(seeAllLink(root, 'en')), 'got the button inside the scroller').toBe(false);
	});

	it('row: padding 10px 8px, hairline bottom border, radius 8px, gap 10px, centred', async () => {
		const [row] = rowLinks(await renderDetails());
		expect(style(row, 'display')).toBe('flex');
		expect(style(row, 'align-items')).toBe('center');
		expect(style(row, 'padding')).toBe('10px 8px');
		expect(style(row, 'column-gap')).toBe('10px');
		expect(style(row, 'border-top-left-radius')).toBe('8px');
		expect(style(row, 'border-bottom-width')).toBe('1px');
		expect(style(row, 'border-bottom-style')).toBe('solid');
		expect(style(row, 'border-bottom-color')).toBe(computed('color', 'var(--border-hairline)'));
		expect(style(row, 'background-color'), 'got a tinted row').toBe('rgba(0, 0, 0, 0)');
	});

	it('thumb: 42×42, radius 8px', async () => {
		const [row] = rowLinks(await renderDetails());
		const boxes = thumbBoxes(row);
		expect(boxes.length, 'got no 42×42 box around the row photo').toBeGreaterThan(0);
		const radii = boxes.map((el) => style(el, 'border-top-left-radius'));
		expect(radii, 'want the 42px thumb rounded 8px').toContain('8px');
	});

	it('name 13.5px/600 and region 10.5px on one baseline row, the description below', async () => {
		const variation = dishIn('en', 'tortilla').variations[0];
		const [row] = rowLinks(await renderDetails());
		const name = textElement(row, variation.name);
		const region = textElement(row, variation.regionName);
		const description = textElement(row, variation.description);
		expect(style(name, 'font-size')).toBe('13.5px');
		expect(style(name, 'font-weight')).toBe('600');
		expect(style(region, 'font-size')).toBe('10.5px');
		const line = commonAncestor(name, region);
		expect(line.contains(description), 'got the description on the name line').toBe(false);
		expect(style(line, 'display')).toBe('flex');
		expect(style(line, 'align-items')).toBe('baseline');
		const nameBox = name.getBoundingClientRect();
		expect(region.getBoundingClientRect().left, 'want the region after the name').toBeGreaterThan(
			nameBox.left
		);
		expect(
			description.getBoundingClientRect().top,
			'want the description below'
		).toBeGreaterThanOrEqual(nameBox.bottom - 0.5);
	});

	it('description: 11px ink-2, line-height 1.35', async () => {
		const variation = dishIn('en', 'tortilla').variations[0];
		const [row] = rowLinks(await renderDetails());
		const description = textElement(row, variation.description);
		expect(style(description, 'font-size')).toBe('11px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 11 * 1.35, 'row description line-height');
	});

	it(`the region text passes AA (≥ ${MIN_TEXT_CONTRAST}:1) on --bg-surface`, async () => {
		const variation = dishIn('en', 'tortilla').variations[0];
		const [row] = rowLinks(await renderDetails());
		const surface = computed('background-color', 'var(--bg-surface)');
		const ratio = textContrast(textElement(row, variation.regionName), surface);
		expect(ratio, `got ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
	});

	it('"See all variations": the regular primary button (padding 15px, 14px/600, radius 14px)', async () => {
		const link = seeAllLink(await renderDetails(), 'en');
		expect(style(link, 'display')).toBe('block');
		expect(style(link, 'padding')).toBe('15px');
		expect(style(link, 'font-size')).toBe('14px');
		expect(style(link, 'font-weight')).toBe('600');
		expect(style(link, 'border-top-left-radius')).toBe(
			computed('border-top-left-radius', 'var(--radius-button)')
		);
		expect(style(link, 'background-color')).toBe(computed('background-color', 'var(--bg-button)'));
		expect(style(link, 'color')).toBe(computed('color', 'var(--on-accent)'));
	});

	it('every :hover rule on the rows is under @media (hover: hover)', async () => {
		for (const row of rowLinks(await renderDetails())) {
			expect(ungatedHoverRules(row), `got ungated :hover on ${row.getAttribute('href')}`).toEqual(
				[]
			);
		}
	});
});
