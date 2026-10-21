import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import {
	dishIn,
	dishWithVariations,
	normalized,
	type Dish,
	type DishCardProps
} from '../../testutil/popular';
import {
	NOT_THE_GLOSSARY,
	PREVIEWS,
	TEST_IDS,
	VARIATION_COUNTS,
	type PopularLocale
} from '../../testutil/popular-copy';
import {
	computed,
	loadContent,
	stage,
	style,
	ungatedHoverRules,
	useViewport
} from '../../testutil/ui';

// FE-5 PR 1, DishCard: one dish in the mobile Popular list. A content
// component (src/lib/content/): data only, never a container.
//
// Sources, by line:
// - Mobile README -> Popular tab — body L87–93: "Card: bg --bg-surface, 1px
//   --border-card, radius 16px, padding 14px 15px, column gap 7px. Hover bg
//   #FDFAF3. Photo: height 96px, radius 11px. Row (space-between, baseline):
//   dish name (Instrument Serif 21px) and "13 variations" (11px/700, .06em,
//   accent). The word is "variations", never "versions", "recipes" or
//   "ways". Description: 11.5px, ink-2, lh 1.4. Preview line (top hairline,
//   padding-top 7px): first two variations as "Region · Variation · Region ·
//   Variation", 11px ink-3. No tag pills."
// - Mobile prototype (Asadorov Explorations.dc.html) L263–271: name
//   line-height 1.1; the name row gap 10px; the count nowrap; preview
//   line-height 1.35, border-top rgba(43,30,22,.08) (= --border-hairline);
//   preview = ks.slice(0, 2).map(region name + ' · ' + variation).join('  ·  ').
// - Stage FE-5 -> Result list: the preview is "in region order"; the API
//   already sends a dish's variations in region order (openapi.yaml Dish.variations),
//   so the card takes the first two as given.
// - Contrast (stack.md X10): the count is accent-coloured text, so
//   --accent-text; ink-2 / ink-3 are the layout.css AA overrides.
//
// Decisions pinned here (FE-5 PR 1):
// - Props { dish, href, mediaBaseUrl }. The root is ONE link
//   (data-testid="dish-card", href = the prop) holding everything; nothing
//   else in it is focusable. PR 1's href is ?tab=popular&dish=<key> (E2E).
// - The dish name is an <h3> (the Popular panel's own heading is above it).
// - The photo is the dish's `card` role, decorative (alt ""): the card is
//   named by its text.
// - The card's text is exactly name, count, description, preview, in that
//   order: no tag pills, no recipe counts, no other label.

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const PHOTO = 'picture, [class~="placeholder"]';
const MEDIA = 'https://media.invalid';
const CARD_HOVER_BG = '#FDFAF3';
const MOBILE_CARD_WIDTH_PX = 358;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

type RenderSpec = { lang?: PopularLocale; dish?: Dish; href?: string; mediaBaseUrl?: string };

async function renderCard(spec: RenderSpec = {}): Promise<HTMLAnchorElement> {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const DishCard = await loadContent<DishCardProps>('DishCard');
	const target = stage(`width: ${MOBILE_CARD_WIDTH_PX}px; background: var(--bg-page)`);
	const props: DishCardProps = {
		dish: spec.dish ?? dishIn(lang, 'tortilla'),
		href: spec.href ?? `/${lang}/?tab=popular&dish=tortilla`,
		mediaBaseUrl: spec.mediaBaseUrl
	};
	render(DishCard, { target, props });
	const root = target.querySelector<HTMLAnchorElement>(`[data-testid="${TEST_IDS.dishCard}"]`);
	expect(root, `got no [data-testid="${TEST_IDS.dishCard}"] root`).not.toBeNull();
	return root!;
}

// The deepest element whose whole (whitespace-collapsed) text is `text`.
function textElement(root: Element, text: string): HTMLElement {
	const all = [root, ...root.querySelectorAll('*')].filter(
		(el) => normalized(el.textContent) === text
	) as HTMLElement[];
	const leaf = all.find((el) => !all.some((other) => other !== el && el.contains(other)));
	expect(
		leaf,
		`got no element with the text "${text}" in "${normalized(root.textContent)}"`
	).toBeDefined();
	return leaf!;
}

function photoIn(card: Element): HTMLElement {
	const photo = card.querySelector<HTMLElement>(PHOTO);
	expect(photo, 'got no photo in the card').not.toBeNull();
	return photo!;
}

const px = (el: Element, property: string) => parseFloat(style(el, property));

function expectPx(got: number, want: number, what: string) {
	expect(Math.abs(got - want), `got ${what} ${got}px, want ${want}px`).toBeLessThanOrEqual(0.5);
}

// Every text node, trimmed and joined by one space: what a reader reads, in
// order, whatever whitespace the markup puts between elements.
function readText(root: Element): string {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const parts: string[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = normalized(node.textContent);
		if (text) parts.push(text);
	}
	return parts.join(' ');
}

const previewOf = (dish: Dish) =>
	dish.variations
		.slice(0, 2)
		.map((v) => `${v.regionName} · ${v.name}`)
		.join(' · ');

describe('DishCard: one link to the href', () => {
	it('the root is a link to the given href', async () => {
		const card = await renderCard({ href: '/en/?tab=popular&f=vegetarian&dish=tortilla' });
		expect(card.tagName, 'want the card root to be an <a>').toBe('A');
		expect(card.getAttribute('href')).toBe('/en/?tab=popular&f=vegetarian&dish=tortilla');
	});

	it('nothing inside the card is focusable (no nested link or button)', async () => {
		const card = await renderCard();
		const inner = [...card.querySelectorAll(FOCUSABLE)];
		expect(
			inner.map((el) => el.outerHTML.slice(0, 80)),
			'got focusable content'
		).toEqual([]);
	});
});

describe('DishCard: content', () => {
	for (const lang of ['en', 'es', 'ru'] as const) {
		it(`${lang}: the dish name is the card's one heading, an <h3>`, async () => {
			const dish = dishIn(lang, 'tortilla');
			const card = await renderCard({ lang, dish });
			const headings = [...card.querySelectorAll('h1, h2, h3, h4, h5, h6')];
			expect(
				headings.map((h) => h.tagName),
				'want exactly one heading, an <h3>'
			).toEqual(['H3']);
			expect(normalized(headings[0].textContent)).toBe(dish.name);
		});

		it(`${lang}: name, count, description, preview — and nothing else`, async () => {
			const dish = dishIn(lang, 'paella');
			const card = await renderCard({ lang, dish });
			const want = [
				dish.name,
				VARIATION_COUNTS[lang].paella,
				dish.description,
				PREVIEWS[lang].paella
			];
			expect(readText(card), 'got other text (a tag pill?) or another order').toBe(want.join(' '));
		});
	}

	it('shows the description', async () => {
		const dish = dishIn('en', 'gazpacho');
		const card = await renderCard({ dish });
		textElement(card, dish.description);
	});

	it('never words a variation as a version or a recipe', async () => {
		for (const lang of ['en', 'es', 'ru'] as const) {
			const card = await renderCard({ lang });
			expect(normalized(card.textContent), `${lang}: got a non-glossary word`).not.toMatch(
				NOT_THE_GLOSSARY
			);
		}
	});
});

describe('DishCard: "N variations" (ICU plural home.variation)', () => {
	const cases: { lang: PopularLocale; count: number; want: string }[] = [
		{ lang: 'en', count: 1, want: '1 variation' },
		{ lang: 'en', count: 2, want: '2 variations' },
		{ lang: 'en', count: 13, want: '13 variations' },
		{ lang: 'es', count: 1, want: '1 variante' },
		{ lang: 'es', count: 5, want: '5 variantes' },
		{ lang: 'ru', count: 1, want: '1 вариант' },
		{ lang: 'ru', count: 2, want: '2 варианта' },
		{ lang: 'ru', count: 5, want: '5 вариантов' },
		{ lang: 'ru', count: 11, want: '11 вариантов' }
	];
	for (const tc of cases) {
		it(`${tc.lang}: ${tc.count} → "${tc.want}"`, async () => {
			const card = await renderCard({ lang: tc.lang, dish: dishWithVariations(tc.lang, tc.count) });
			textElement(card, tc.want);
		});
	}

	it('counts the dish\'s variations: torrijas in ru has 6 → "6 вариантов"', async () => {
		const card = await renderCard({ lang: 'ru', dish: dishIn('ru', 'torrijas') });
		textElement(card, VARIATION_COUNTS.ru.torrijas!);
	});
});

describe('DishCard: the preview line (first two variations, region order)', () => {
	const cases: { lang: PopularLocale; key: 'tortilla' | 'paella' }[] = [
		{ lang: 'en', key: 'tortilla' },
		{ lang: 'en', key: 'paella' },
		{ lang: 'es', key: 'paella' },
		{ lang: 'ru', key: 'tortilla' },
		{ lang: 'ru', key: 'paella' }
	];
	for (const tc of cases) {
		it(`${tc.lang} ${tc.key}: "${PREVIEWS[tc.lang][tc.key]}"`, async () => {
			const card = await renderCard({ lang: tc.lang, dish: dishIn(tc.lang, tc.key) });
			textElement(card, PREVIEWS[tc.lang][tc.key]!);
		});
	}

	it('takes the first two variations as given (the API sends region order)', async () => {
		const dish = dishIn('en', 'croquetas');
		const card = await renderCard({ dish });
		textElement(card, previewOf(dish));
	});

	it('a dish with one variation previews just that one: "Region · Variation"', async () => {
		const dish = dishWithVariations('en', 1);
		const card = await renderCard({ dish });
		textElement(card, 'Galicia · Betanzos-style runny');
	});

	it('no variation is marked: the two preview entries share one element and style', async () => {
		const card = await renderCard();
		const preview = textElement(card, PREVIEWS.en.tortilla!);
		const marked = preview.querySelectorAll('strong, b, em, mark, [aria-current]');
		expect(marked.length, 'got a highlighted variation in the preview').toBe(0);
	});
});

describe('DishCard: photo', () => {
	it('uses the dish\'s card photo, decorative (alt "")', async () => {
		const tortilla = dishIn('en', 'tortilla');
		const dish = {
			...tortilla,
			photos: {
				thumb: 'dishes/tortilla/thumb-1',
				card: 'dishes/tortilla/card-1',
				hero: 'dishes/tortilla/hero-1'
			}
		};
		const card = await renderCard({ dish, mediaBaseUrl: MEDIA });
		const img = card.querySelector('img');
		expect(img, 'got no <img> with a media base URL and a card photo').not.toBeNull();
		expect(img!.getAttribute('src') ?? '', 'want the card role').toContain(
			`${MEDIA}/dishes/tortilla/card-1`
		);
		expect(img!.getAttribute('alt'), 'want alt="" on the card photo').toBe('');
	});

	it('draws the placeholder without a photo', async () => {
		const card = await renderCard();
		expect(card.querySelector('img'), 'got an <img> without a photo').toBeNull();
		photoIn(card);
	});
});

describe('DishCard: mobile styles (< 860px)', () => {
	useViewport(390, 844);

	it('card: --bg-surface, 1px --border-card, radius 16px, padding 14px 15px, column gap 7px', async () => {
		const card = await renderCard();
		expect(style(card, 'background-color')).toBe(computed('background-color', 'var(--bg-surface)'));
		expect(style(card, 'border-top-width')).toBe('1px');
		expect(style(card, 'border-top-style')).toBe('solid');
		expect(style(card, 'border-top-color')).toBe(computed('color', 'var(--border-card)'));
		expect(style(card, 'border-top-left-radius')).toBe('16px');
		expect(style(card, 'padding')).toBe('14px 15px');
		expect(style(card, 'display')).toBe('flex');
		expect(style(card, 'flex-direction')).toBe('column');
		expect(style(card, 'row-gap')).toBe('7px');
	});

	it('photo: full width, 96px tall, radius 11px', async () => {
		const card = await renderCard();
		const photo = photoIn(card);
		const box = photo.getBoundingClientRect();
		expectPx(box.height, 96, 'photo height');
		expectPx(box.width, MOBILE_CARD_WIDTH_PX - 2 * 15 - 2, 'photo width');
		expect(style(photo, 'border-top-left-radius')).toBe('11px');
	});

	it('name row: 21px Instrument Serif lh 1.1; count 11px/700 .06em --accent-text nowrap; baseline, space-between, gap 10px', async () => {
		const card = await renderCard();
		const name = card.querySelector('h3')!;
		const count = textElement(card, VARIATION_COUNTS.en.tortilla!);
		expect(style(name, 'font-size')).toBe('21px');
		expect(style(name, 'font-family')).toBe(computed('font-family', 'var(--font-display)'));
		expectPx(px(name, 'line-height'), 21 * 1.1, 'name line-height');
		expect(style(name, 'margin-top'), 'want no default heading margin').toBe('0px');
		expect(style(count, 'font-size')).toBe('11px');
		expect(style(count, 'font-weight')).toBe('700');
		expectPx(px(count, 'letter-spacing'), 11 * 0.06, 'count letter-spacing');
		expect(style(count, 'color')).toBe(computed('color', 'var(--accent-text)'));
		expect(style(count, 'white-space')).toBe('nowrap');
		const row = name.parentElement!;
		expect(row.contains(count), 'want the count in the name row').toBe(true);
		expect(style(row, 'display')).toBe('flex');
		expect(style(row, 'align-items')).toBe('baseline');
		expect(style(row, 'justify-content')).toBe('space-between');
		expect(style(row, 'column-gap')).toBe('10px');
	});

	it('description: 11.5px --ink-2, lh 1.4', async () => {
		const dish = dishIn('en', 'tortilla');
		const card = await renderCard({ dish });
		const description = textElement(card, dish.description);
		expect(style(description, 'font-size')).toBe('11.5px');
		expect(style(description, 'color')).toBe(computed('color', 'var(--ink-2)'));
		expectPx(px(description, 'line-height'), 11.5 * 1.4, 'description line-height');
	});

	it('preview: 11px --ink-3 lh 1.35, top hairline --border-hairline, padding-top 7px', async () => {
		const card = await renderCard();
		const preview = textElement(card, PREVIEWS.en.tortilla!);
		expect(style(preview, 'font-size')).toBe('11px');
		expect(style(preview, 'color')).toBe(computed('color', 'var(--ink-3)'));
		expectPx(px(preview, 'line-height'), 11 * 1.35, 'preview line-height');
		expect(style(preview, 'border-top-width')).toBe('1px');
		expect(style(preview, 'border-top-style')).toBe('solid');
		expect(style(preview, 'border-top-color')).toBe(computed('color', 'var(--border-hairline)'));
		expect(style(preview, 'padding-top')).toBe('7px');
	});

	it('the link text is not underlined and keeps the ink colour', async () => {
		const card = await renderCard();
		expect(style(card, 'text-decoration-line')).toBe('none');
		expect(style(card.querySelector('h3')!, 'color')).toBe(computed('color', 'var(--ink)'));
	});

	it(`hover: background ${CARD_HOVER_BG}, only under (hover: hover)`, async () => {
		const card = await renderCard();
		await userEvent.hover(card);
		await expect
			.poll(() => style(card, 'background-color'))
			.toBe(computed('background-color', CARD_HOVER_BG));
		expect(ungatedHoverRules(card), 'got :hover rules outside @media (hover: hover)').toEqual([]);
	});
});
