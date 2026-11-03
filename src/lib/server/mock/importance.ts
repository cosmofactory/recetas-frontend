import type { BundleDish } from './bundle.ts';

// The backend's display order (stack.md X15), for the mock source: dishes by
// the sum of their variations' importance scores, then bundle position; each
// region's variations by score, then dish display order. Scores carry 3
// decimals, so they are summed as integer thousandths to keep exact ties exact.

const SCORE_SCALE = 1000;

const thousandths = (score: number | undefined) => Math.round((score ?? 0) * SCORE_SCALE);

const dishScore = (dish: BundleDish) =>
	dish.variations.reduce((sum, v) => sum + thousandths(v.score), 0);

// Array.prototype.toSorted is stable, so equal scores keep the given order.
export function byDisplayOrder(dishes: readonly BundleDish[]): BundleDish[] {
	return dishes.toSorted((a, b) => dishScore(b) - dishScore(a));
}

// recipeKey -> 1-based position in its region's list. `dishes` must already be
// in display order.
export function regionRanks(dishes: readonly BundleDish[]): Map<string, number> {
	const ranked = dishes
		.flatMap((dish) => dish.variations)
		.toSorted((a, b) => thousandths(b.score) - thousandths(a.score));
	const next = new Map<string, number>();
	return new Map(
		ranked.map((v) => {
			const rank = (next.get(v.regionKey) ?? 0) + 1;
			next.set(v.regionKey, rank);
			return [v.recipeKey, rank];
		})
	);
}
