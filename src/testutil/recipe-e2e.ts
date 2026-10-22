import { expect, type Locator, type Page } from '@playwright/test';
import { tokenValue } from './home-e2e';
import {
	betanzosIngredients,
	DONE_ROW_OPACITY,
	DONE_TEXT_COLOUR_TOKEN,
	RECIPE_COPY,
	RECIPE_TEST_IDS,
	servingsAnnouncement,
	type CheckedServings,
	type IngredientRow,
	type RecipeLocale
} from './recipe-copy';

// Shared fixtures for the FE-6 PR 3 Recipe page Playwright specs. Content is
// the vendored mock bundle (DATA_SOURCE=mock); copy is in recipe-copy.ts.

export const ingredientRows = (page: Page): Locator => page.getByTestId(RECIPE_TEST_IDS.ingredient);
export const stepRows = (page: Page): Locator => page.getByTestId(RECIPE_TEST_IDS.step);
export const servingsValue = (page: Page): Locator =>
	page.getByTestId(RECIPE_TEST_IDS.servingsValue);
export const servingsLive = (page: Page): Locator => page.getByTestId(RECIPE_TEST_IDS.servingsLive);

export const fewerButton = (page: Page, lang: RecipeLocale): Locator =>
	page.getByRole('button', { name: RECIPE_COPY[lang].fewer, exact: true });

export const moreButton = (page: Page, lang: RecipeLocale): Locator =>
	page.getByRole('button', { name: RECIPE_COPY[lang].more, exact: true });

// What the rows show: each row's quantity, and its name when the row's text has it.
function shownIngredients(page: Page, want: IngredientRow[]): Promise<IngredientRow[]> {
	return ingredientRows(page).evaluateAll(
		(rows, args) =>
			rows.map((row, i) => {
				const text = (row.textContent ?? '').replace(/\s+/g, ' ').trim();
				const name = args.want[i]?.name ?? '';
				const quantity = row.querySelector(`[data-testid="${args.quantityId}"]`);
				return {
					name: name && text.includes(name) ? name : `(not in "${text}")`,
					quantity: (quantity?.textContent ?? '(no quantity)').replace(/\s+/g, ' ').trim()
				};
			}),
		{ want, quantityId: RECIPE_TEST_IDS.quantity }
	);
}

export async function expectBetanzosAt(page: Page, lang: RecipeLocale, servings: CheckedServings) {
	const want = betanzosIngredients(lang, servings);
	await expect
		.poll(() => shownIngredients(page, want), { message: `${lang}: ingredients at ${servings}` })
		.toEqual(want);
}

export async function expectServings(page: Page, count: number) {
	await expect(servingsValue(page)).toHaveText(String(count));
}

export async function expectAnnounced(page: Page, lang: RecipeLocale, count: number) {
	const live = servingsLive(page);
	await expect(live).toHaveAttribute('aria-live', 'polite');
	await expect(live).toHaveText(servingsAnnouncement(lang, count));
}

// Presses + or − until the stepper shows `target`.
export async function stepServingsTo(page: Page, lang: RecipeLocale, from: number, target: number) {
	const button = target > from ? moreButton(page, lang) : fewerButton(page, lang);
	for (let n = from; n !== target; n += target > from ? 1 : -1) await button.click();
	await expectServings(page, target);
}

export type RowLook = {
	pressed: string | null;
	opacity: string;
	struck: boolean;
	check: string;
	textColours: string[];
};

// A row's state as a reader sees it: aria-pressed, the row's opacity, whether
// any element from the row down to its text is struck through, the check
// circle's background, and the distinct colours of the row's text (every
// element holding a text node, outside the check circle).
export async function rowLook(row: Locator): Promise<RowLook> {
	return row.evaluate((el, checkId) => {
		const check = el.querySelector(`[data-testid="${checkId}"]`);
		const nodes = [el, ...el.querySelectorAll('*')];
		const struck = nodes.some((node) =>
			getComputedStyle(node).textDecorationLine.includes('line-through')
		);
		const holdsText = (node: Element) =>
			[...node.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim());
		const textNodes = nodes.filter((node) => holdsText(node) && !check?.contains(node));
		return {
			pressed: el.getAttribute('aria-pressed'),
			opacity: getComputedStyle(el).opacity,
			struck,
			check: check ? getComputedStyle(check).backgroundColor : '(no check circle)',
			textColours: [...new Set(textNodes.map((node) => getComputedStyle(node).color))]
		};
	}, RECIPE_TEST_IDS.check);
}

export type DoneColours = { accent: string; doneText: string };

// The --accent check fill and the --ink-3 done text, resolved in the page.
export async function doneColours(page: Page): Promise<DoneColours> {
	return {
		accent: await tokenValue(page, 'background-color', 'var(--accent)'),
		doneText: await tokenValue(page, 'color', DONE_TEXT_COLOUR_TOKEN)
	};
}

export async function expectRowDone(row: Locator, colours: DoneColours, struck: boolean) {
	const want: RowLook = {
		pressed: 'true',
		opacity: DONE_ROW_OPACITY,
		struck,
		check: colours.accent,
		textColours: [colours.doneText]
	};
	await expect.poll(() => rowLook(row), { message: 'want the row done' }).toEqual(want);
}

export async function expectRowOpen(row: Locator, colours: DoneColours) {
	await expect(row).toHaveAttribute('aria-pressed', 'false');
	await expect
		.poll(async () => {
			const look = await rowLook(row);
			return {
				opacity: look.opacity,
				struck: look.struck,
				accentCheck: look.check === colours.accent,
				allDoneText: look.textColours.every((c) => c === colours.doneText)
			};
		})
		.toEqual({ opacity: '1', struck: false, accentCheck: false, allDoneText: false });
}

// Whether a pointer `reach` px left, right, above and below the control's
// centre still hits it (a 2·reach+1 px hit area on both axes).
export function hitsAround(control: Locator, reach: number): Promise<boolean> {
	return control.evaluate((el, offset) => {
		const r = el.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const y = r.top + r.height / 2;
		const hit = (px: number, py: number) => {
			const target = document.elementFromPoint(px, py);
			return target !== null && (target === el || el.contains(target));
		};
		return [hit(x - offset, y), hit(x + offset, y), hit(x, y - offset), hit(x, y + offset)].every(
			Boolean
		);
	}, reach);
}

// A same-route client navigation (Recipe → Recipe) as a future in-page link
// (FE-7 search) would make it: a plain <a> clicked inside the app, which
// SvelteKit routes without remounting the page component.
export async function clientNavigate(page: Page, path: string) {
	await page.evaluate((href) => {
		const link = document.createElement('a');
		link.href = href;
		document.querySelector('main')?.append(link);
		link.click();
	}, path);
}
