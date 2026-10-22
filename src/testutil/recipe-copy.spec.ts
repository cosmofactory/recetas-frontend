import { describe, expect, it } from 'vitest';
import { expectedIngredients, recipeIn } from './recipe';
import {
	BETANZOS,
	BETANZOS_STEPS,
	betanzosIngredients,
	CHECKED_SERVINGS,
	RECIPE_LOCALES
} from './recipe-copy';

// The Playwright specs read the Betanzos rows from recipe-copy.ts; this keeps
// that table equal to what the bundle and the real formatter give.

describe('recipe-copy: Betanzos fixture matches the bundle and the formatter', () => {
	for (const lang of RECIPE_LOCALES) {
		const recipe = recipeIn(lang, 'tortilla', 'gal');

		for (const servings of CHECKED_SERVINGS) {
			it(`${lang}: ${servings} servings`, () => {
				expect(betanzosIngredients(lang, servings)).toEqual(
					expectedIngredients(lang, recipe, servings)
				);
			});
		}

		it(`${lang}: names, base servings and steps`, () => {
			const copy = BETANZOS[lang];
			expect([recipe.regionName, recipe.dishName, recipe.name, recipe.description]).toEqual([
				copy.region,
				copy.dish,
				copy.name,
				copy.description
			]);
			expect(recipe.baseServings).toBe(copy.baseServings);
			const steps = BETANZOS_STEPS[lang];
			expect([recipe.steps.length, recipe.steps[0], recipe.steps.at(-1)]).toEqual([
				steps.count,
				steps.first,
				steps.last
			]);
		});
	}
});
