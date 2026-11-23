import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import {
	BETANZOS_TIPS,
	RECIPE_COPY,
	RECIPE_LOCALES,
	RECIPE_TEST_IDS,
	type RecipeLocale
} from '../../../testutil/recipe-copy';
import { loadRecipeComponent, stage, useViewport } from '../../../testutil/ui';

// FE-10 (D-CNT2-3), RecipeTips: the 0–3 one-line tips shown after the
// method steps, under a heading, in both layouts.
//
// Sources: specs/stages/content/CNT-2-authority-books.md -> D-CNT2-3 and
// FE-10 ("A small RecipeTips component under MethodSteps in both layouts,
// hidden when empty; heading strings in en/es/ru. Tests: hidden when empty,
// rendered in order, the localized heading").
//
// Decisions pinned here (assumptions where the stage file is silent):
// - Props: { tips: string[] }, the API's Recipe.tips as is.
// - The root is data-testid="recipe-tips"; its heading is an <h2> (the
//   level of "Method", MethodSteps' heading), reading m.recipe_tips()
//   (extra-strings.json recipe.tips: Tips / Trucos / Советы); then a <ul> or
//   <ol> with one direct <li> per tip, in order.
// - Tips are plain text, never toggles, links or buttons.
// - Empty tips render nothing at all: no heading, no list, no wrapper.
// - Text may be typeset (non-breaking spaces after short words), so it is
//   compared with ordinary spaces.

type TipsProps = { tips: string[] };

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

async function renderTips(tips: string[], lang: RecipeLocale = 'en'): Promise<HTMLElement> {
	overwriteGetLocale(() => lang);
	const RecipeTips = await loadRecipeComponent<TipsProps>('RecipeTips');
	const target = stage('background: var(--bg-page)');
	render(RecipeTips, { target, props: { tips } });
	return target;
}

const plainText = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function tipsRoot(target: HTMLElement): HTMLElement {
	const root = target.querySelector<HTMLElement>(`[data-testid="${RECIPE_TEST_IDS.tips}"]`);
	expect(root, `got no data-testid="${RECIPE_TEST_IDS.tips}"`).not.toBeNull();
	return root!;
}

function tipsList(root: HTMLElement): HTMLElement {
	const list = root.querySelector<HTMLElement>('ul, ol');
	expect(list, 'got no <ul> or <ol> in the tips').not.toBeNull();
	return list!;
}

const itemTexts = (list: HTMLElement) =>
	[...list.children].filter((el) => el.tagName === 'LI').map(plainText);

describe('RecipeTips: heading', () => {
	for (const lang of RECIPE_LOCALES) {
		const want = RECIPE_COPY[lang].tips;

		it(`${lang}: one <h2> reading "${want}"`, async () => {
			const root = tipsRoot(await renderTips(BETANZOS_TIPS[lang], lang));
			const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')];
			expect(headings.map((h) => [h.tagName, plainText(h)])).toEqual([['H2', want]]);
		});
	}

	it('the heading comes before the list', async () => {
		const root = tipsRoot(await renderTips(BETANZOS_TIPS.en));
		const heading = root.querySelector('h2');
		expect(heading, 'got no <h2>').not.toBeNull();
		const order = heading!.compareDocumentPosition(tipsList(root));
		expect(
			order & Node.DOCUMENT_POSITION_FOLLOWING,
			'got the list before the heading'
		).toBeTruthy();
	});
});

describe('RecipeTips: list', () => {
	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: one <li> per tip, in order`, async () => {
			const root = tipsRoot(await renderTips(BETANZOS_TIPS[lang], lang));
			expect(itemTexts(tipsList(root))).toEqual(BETANZOS_TIPS[lang]);
		});
	}

	it('a single tip is one item', async () => {
		const root = tipsRoot(await renderTips([BETANZOS_TIPS.en[1]]));
		expect(itemTexts(tipsList(root))).toEqual([BETANZOS_TIPS.en[1]]);
	});

	it('keeps the given order (no sorting)', async () => {
		const reversed = BETANZOS_TIPS.ru.toReversed();
		const root = tipsRoot(await renderTips(reversed, 'ru'));
		expect(itemTexts(tipsList(root))).toEqual(reversed);
	});

	it('the tips are plain text: no button, link or input', async () => {
		const root = tipsRoot(await renderTips(BETANZOS_TIPS.en));
		const controls = [...root.querySelectorAll('a, button, input, [role="button"]')];
		expect(
			controls.map((el) => el.tagName),
			'want no control'
		).toEqual([]);
	});
});

describe('RecipeTips: no tips', () => {
	for (const lang of RECIPE_LOCALES) {
		it(`${lang}: renders nothing: no heading, no list, no wrapper`, async () => {
			const target = await renderTips([], lang);
			expect(target.children.length, `got ${target.innerHTML}, want nothing`).toBe(0);
			expect(plainText(target)).toBe('');
		});
	}
});

// D-CNT2-3: "in both layouts (mobile 5a: after the steps; desktop: method
// column, below the steps)".
for (const [layout, width, height] of [
	['mobile', 390, 844],
	['desktop', 1280, 900]
] as const) {
	describe(`RecipeTips: shown on ${layout} (${width}px)`, () => {
		useViewport(width, height);

		it('the heading and every tip are visible', async () => {
			const root = tipsRoot(await renderTips(BETANZOS_TIPS.en));
			const parts = [root.querySelector('h2'), ...root.querySelectorAll('li')];
			expect(parts.length, 'got no heading or items').toBe(1 + BETANZOS_TIPS.en.length);
			for (const el of parts) {
				expect(el?.checkVisibility(), `got a hidden <${el?.tagName}>`).toBe(true);
			}
		});
	});
}
