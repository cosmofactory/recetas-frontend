import { expect, test, type Locator } from '../testutil/e2e-test';
import { gotoHydrated } from '../testutil/home-e2e';
import { skipOnDesktop } from '../testutil/popular-e2e';
import { RECIPE_TEST_IDS } from '../testutil/recipe-copy';
import { regionSheet } from '../testutil/region-e2e';
import { REGIONS, DISHES, resultGroup, resultOption, searchFor } from '../testutil/search-e2e';

// FE-9 FB-1, hanging short words, end to end on mobile ru (the owner's
// report: "…в Каталонии и⏎Галисии"). The rules are pinned in
// src/lib/i18n/typography.spec.ts; here only that the rendered text carries
// the no-break spaces, for UI copy (ICU messages) and API content alike, and
// that search still matches plain text.
//
// Decisions pinned here:
// - The reported sentence isn't in the catalog or the messages; the same
//   pattern ("в X", "и Y") is checked on text that is: the about copy
//   (home.aboutBody, a UI message) and Madrid's description (API content,
//   the region sheet).
// - Text is read with textContent: Playwright's toHaveText/getByText fold
//   U+00A0 into a plain space, so they can't tell the two apart.
// - Content comes from the mock bundle (demo is seeded from the same file).

const NBSP = ' ';
const MOBILE_TAGS = { tag: ['@cross-browser'] };

const show = (s: string) => JSON.stringify(s).replaceAll(NBSP, '⍽');

async function expectTextContains(locator: Locator, want: string[], what: string) {
	const text = (await locator.textContent()) ?? '';
	for (const part of want) {
		expect(
			text.includes(part),
			`${what}: got ${show(text)}, want it to contain ${show(part)}`
		).toBe(true);
	}
}

const bound = (text: string) => text.replaceAll('_', NBSP);

test.describe('ru: short words are bound to the next word (FE-9 FB-1)', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page, 'mobile ru check (FB-1 report)'));

	test(
		'the about copy binds "в" and "и" (and "и у") to the next word',
		MOBILE_TAGS,
		async ({ page }) => {
			await gotoHydrated(page, '/ru/');
			const body = page.locator('main p', { hasText: 'атлас испанской домашней кухни' });
			await expectTextContains(
				body,
				[bound('в_каждом регионе'), bound('и_у_каждого варианта')],
				'about paragraph'
			);
		}
	);

	test('the region sheet description binds "в", "и" and "с"', MOBILE_TAGS, async ({ page }) => {
		await gotoHydrated(page, '/ru/regions/mad');
		const description = regionSheet(page).getByText('Косидо в три подачи', { exact: false });
		await expectTextContains(
			description,
			[bound('в_три подачи'), bound('и_бутерброд'), bound('с_кальмарами')],
			'Madrid description'
		);
	});
});

test.describe('ru recipe: prepositions and number + unit (FE-9 FB-1)', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page, 'mobile ru check (FB-1 report)'));

	test('a step binds its short prepositions', MOBILE_TAGS, async ({ page }) => {
		await gotoHydrated(page, '/ru/dishes/tortilla/gal');
		const step = page.getByTestId(RECIPE_TEST_IDS.step).nth(1);
		await expectTextContains(
			step,
			[bound('в_масле'), bound('на_слабом'), bound('до_мягкости'), bound('не_обжаривая')],
			'step 2'
		);
	});

	test('quantities and the time bind the number to its unit', MOBILE_TAGS, async ({ page }) => {
		await gotoHydrated(page, '/ru/dishes/tortilla/gal');
		const quantities = page.getByTestId(RECIPE_TEST_IDS.quantity);
		await expectTextContains(quantities.nth(1), [bound('400_г')], 'potatoes quantity');
		await expectTextContains(quantities.nth(2), [bound('250_мл')], 'oil quantity');
		await expectTextContains(page.getByTestId(RECIPE_TEST_IDS.time), [bound('25_мин')], 'time');
	});
});

test.describe('ru search ignores the no-break spaces (FE-9 FB-1)', () => {
	test.beforeEach(({ page }) => skipOnDesktop(page, 'the mobile search overlay'));

	const FINDS = [
		{ how: 'plain spaces', query: 'кастилия и леон', group: REGIONS, title: 'Кастилия и Леон' },
		{ how: 'plain spaces', query: 'блюда из риса', group: DISHES, title: 'Блюда из риса' },
		// Pasted from the page, which binds "и" with a no-break space.
		{
			how: 'a no-break space',
			query: `кастилия и${NBSP}леон`,
			group: REGIONS,
			title: 'Кастилия и Леон'
		}
	] as const;

	for (const { how, query, group, title } of FINDS) {
		test(`${show(query)} with ${how} finds ${title}`, MOBILE_TAGS, async ({ page }) => {
			await gotoHydrated(page, '/ru/');
			await searchFor(page, 'ru', query);
			await expect(resultOption(resultGroup(page, 'ru', group), title)).toBeVisible();
		});
	}
});
