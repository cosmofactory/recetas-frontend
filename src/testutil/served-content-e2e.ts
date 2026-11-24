import { expect, type Page } from '@playwright/test';
import { breadcrumbItems, onlyNodeOfType } from './json-ld';
import type { Locale } from './e2e';

// Content names as the server under test serves them. The suite also runs
// against a deployment (E2E_BASE_URL, the nightly demo run), whose content
// bundle is not the vendored mock: a spec that needs a dish's name, rather
// than asserting it, reads it here instead of hard-coding the mock's copy.

// The dish's breadcrumb entry: Asadorov › dish (› variation on a recipe).
const DISH_CRUMB_POSITION = 2;

// The dish's name in `lang`, from the BreadcrumbList JSON-LD of its page
// (a one-variation dish's page redirects to its recipe, whose second crumb
// is the dish too).
export async function servedDishName(page: Page, lang: Locale, dishKey: string): Promise<string> {
	const path = `/${lang}/dishes/${dishKey}`;
	const response = await page.request.get(path);
	expect(response.ok(), `got HTTP ${response.status()} for ${path}, want 200`).toBe(true);
	const crumbs = breadcrumbItems(onlyNodeOfType(await response.text(), 'BreadcrumbList'));
	const dish = crumbs.find((crumb) => crumb.position === DISH_CRUMB_POSITION);
	if (!dish) throw new Error(`got no dish crumb in ${path}'s breadcrumb`);
	return dish.name;
}
