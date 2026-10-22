import type { components } from '#lib/api/schema.d.ts';
import { formatQuantity, scaleQuantity } from './quantity.ts';

type Ingredient = components['schemas']['Ingredient'];

// Mobile README -> Screen 3 -> Info strip: "Range 1–20".
export const SERVINGS_MIN = 1;
export const SERVINGS_MAX = 20;

export const clampServings = (servings: number): number =>
	Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, servings));

// An ingredient's quantity text at `servings` (its quantity is for `baseServings`).
export function ingredientQuantity(
	locale: string,
	ingredient: Ingredient,
	baseServings: number,
	servings: number
): string {
	const value = scaleQuantity(ingredient.quantity, baseServings, servings);
	return formatQuantity(locale, value, ingredient.unit);
}
