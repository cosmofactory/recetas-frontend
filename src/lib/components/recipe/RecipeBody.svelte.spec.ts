import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { recipeIn, type Recipe } from '../../../testutil/recipe';
import {
	BETANZOS,
	BETANZOS_TIPS,
	RECIPE_COPY,
	RECIPE_TEST_IDS
} from '../../../testutil/recipe-copy';
import { loadRecipeComponent, stage, useViewport } from '../../../testutil/ui';

// FE-10 (D-CNT2-3), where RecipeBody puts the tips: "Shown after the method
// steps under a heading, in both layouts (mobile 5a: after the steps;
// desktop: method column, below the steps)". One RecipeBody serves both
// layouts (CSS switches at 860px), so the same DOM is measured at a mobile
// and a desktop width. The server HTML order is pinned in the Recipe page's
// page.ssr.spec.ts; this pins the geometry: on desktop the tips sit in the
// method column (the body grid's second column), not in a new grid row
// under the sticky ingredients card.
//
// Assumption: the tips heading is the <h2> reading the recipe.tips copy and
// "Method" is MethodSteps' <h2> (as today).

type BodyProps = {
	recipe: Recipe;
	title: string;
	lang: string;
	mediaBaseUrl: string | undefined;
};

// Sub-pixel layout can round edges by up to a pixel.
const EDGE_TOLERANCE_PX = 1;

const baseGetLocale = getLocale;
afterEach(() => overwriteGetLocale(baseGetLocale));

async function renderBody(tips: string[]): Promise<HTMLElement> {
	overwriteGetLocale(() => 'en');
	const RecipeBody = await loadRecipeComponent<BodyProps>('RecipeBody');
	const recipe = { ...recipeIn('en', 'tortilla', 'gal'), tips };
	const target = stage('padding: 0; background: var(--bg-page)');
	const props = { recipe, title: BETANZOS.en.title, lang: 'en', mediaBaseUrl: undefined };
	render(RecipeBody, { target, props });
	return target;
}

function headingNamed(root: HTMLElement, text: string): HTMLElement {
	const found = [...root.querySelectorAll<HTMLElement>('h2')].filter(
		(h) => h.textContent?.trim() === text
	);
	expect(found.length, `got ${found.length} <h2> "${text}", want 1`).toBe(1);
	return found[0];
}

function lastStep(root: HTMLElement): HTMLElement {
	const steps = root.querySelectorAll<HTMLElement>(`[data-testid="${RECIPE_TEST_IDS.step}"]`);
	expect(steps.length, 'got no method steps').toBeGreaterThan(0);
	return steps[steps.length - 1];
}

function tipsRoot(root: HTMLElement): HTMLElement {
	const tips = root.querySelector<HTMLElement>(`[data-testid="${RECIPE_TEST_IDS.tips}"]`);
	expect(tips, `got no data-testid="${RECIPE_TEST_IDS.tips}"`).not.toBeNull();
	return tips!;
}

const box = (el: Element) => el.getBoundingClientRect();

function expectBelowLastStep(root: HTMLElement) {
	const stepBottom = box(lastStep(root)).bottom;
	const tipsTop = box(tipsRoot(root)).top;
	expect(
		tipsTop,
		`got the tips top at ${tipsTop}, want at or below the last step's bottom ${stepBottom}`
	).toBeGreaterThanOrEqual(stepBottom - EDGE_TOLERANCE_PX);
}

describe('RecipeBody tips on mobile (390px)', () => {
	useViewport(390, 844);

	it('the tips sit below the last method step', async () => {
		expectBelowLastStep(await renderBody(BETANZOS_TIPS.en));
	});

	it('the tips heading starts where the "Method" heading does', async () => {
		const root = await renderBody(BETANZOS_TIPS.en);
		const method = box(headingNamed(root, RECIPE_COPY.en.method)).left;
		const tips = box(headingNamed(root, RECIPE_COPY.en.tips)).left;
		expect(
			Math.abs(tips - method),
			`got tips at x ${tips}, method at x ${method}`
		).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
	});
});

describe('RecipeBody tips on desktop (1280px)', () => {
	useViewport(1280, 900);

	it('the tips sit below the last method step', async () => {
		expectBelowLastStep(await renderBody(BETANZOS_TIPS.en));
	});

	it('the tips are in the method column, right of the ingredients card', async () => {
		const root = await renderBody(BETANZOS_TIPS.en);
		const method = box(headingNamed(root, RECIPE_COPY.en.method)).left;
		const tips = box(headingNamed(root, RECIPE_COPY.en.tips)).left;
		const card = box(headingNamed(root, RECIPE_COPY.en.ingredients)).right;
		expect(
			Math.abs(tips - method),
			`got tips at x ${tips}, method at x ${method}`
		).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
		expect(tips, `got tips at x ${tips}, want right of the ingredients at ${card}`).toBeGreaterThan(
			card
		);
	});
});

describe('RecipeBody without tips', () => {
	it('renders no tips element and no tips heading', async () => {
		const root = await renderBody([]);
		expect(root.querySelector(`[data-testid="${RECIPE_TEST_IDS.tips}"]`)).toBeNull();
		const headings = [...root.querySelectorAll('h2, h3')].map((h) => h.textContent?.trim());
		expect(headings, `got headings ${JSON.stringify(headings)}`).not.toContain(RECIPE_COPY.en.tips);
	});
});
