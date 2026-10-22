<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import type { components } from '#lib/api/schema.d.ts';
	import { ICONS } from '#lib/components/ui/icons.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { ingredientQuantity } from '#lib/recipe/servings.ts';
	import { desktopQuery } from '#lib/ui/breakpoints.ts';

	type Props = {
		ingredients: components['schemas']['Ingredient'][];
		baseServings: number;
		servings: number;
		lang: string;
	};

	let { ingredients, baseServings, servings, lang }: Props = $props();

	// The check circle's "✓": mobile prototype 11px, desktop prototype 12px.
	const CHECK_ICON_PX = { mobile: 11, desktop: 12 } as const;
	const desktop = new MediaQuery(desktopQuery, false);
	const checkSize = $derived(desktop.current ? CHECK_ICON_PX.desktop : CHECK_ICON_PX.mobile);
	const Check = ICONS.check;

	// "got it" per ingredient, in memory only (X6); the parent remounts this per recipe.
	let got = $state<boolean[]>([]);
</script>

<section class="ingredients" data-testid="recipe-ingredients-card">
	<h2 class="heading">{m.recipe_ingredients()}</h2>
	<ul class="rows" role="list">
		{#each ingredients as ingredient, i (i)}
			<li>
				<button
					type="button"
					class="row"
					class:done={got[i]}
					data-testid="recipe-ingredient"
					aria-pressed={got[i] ? 'true' : 'false'}
					onclick={() => (got[i] = !got[i])}
				>
					<span class="check" data-testid="recipe-check">
						{#if got[i]}<Check size={checkSize} aria-hidden={true} />{/if}
					</span>
					<span class="name">{ingredient.name}</span>
					<span class="quantity" data-testid="recipe-quantity"
						>{ingredientQuantity(lang, ingredient, baseServings, servings)}</span
					>
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	/*
	 * Mobile README -> Screen 3 -> Ingredients: "(padding 26px 20px 0):
	 * "Ingredients" (Instrument Serif 24px). Rows (padding 12px 0, hairline):
	 * 20px circle check, name (14px), quantity right-aligned (13px/600, ink
	 * at .7). Tap toggles "got it": circle fills accent with ✓, text strikes
	 * through, row opacity 0.45"; the prototype gives the 12px gap, the
	 * heading's padding-bottom 6px, the ring's 1.5px and the 200ms fade.
	 */
	.ingredients {
		padding: 26px 20px 0;
	}

	.heading {
		margin: 0;
		padding-bottom: 6px;
		font: 400 24px var(--font-display);
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 0;
		border: 0;
		border-bottom: 1px solid var(--border-hairline);
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	/*
	 * Done: the README's "row opacity 0.45" would put the text at about
	 * 2.4:1, so the text turns --ink-3 instead (stack.md X10, FE-6).
	 */
	.done .name,
	.done .quantity {
		color: var(--ink-3);
	}

	.check {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		box-sizing: border-box;
		border: 1.5px solid var(--border-check);
		border-radius: var(--radius-pill);
		color: var(--on-accent);
	}

	.done .check {
		border-color: var(--accent);
		background: var(--accent);
	}

	.name {
		flex: 1;
		font-size: 14px;
		transition: color var(--dur-colour);
	}

	.done .name {
		text-decoration: line-through;
	}

	.quantity {
		color: var(--ink-quantity);
		transition: color var(--dur-colour);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
	}

	/*
	 * Desktop README -> Recipe page: "ingredients card is sticky (top 24px)";
	 * the prototype: surface card, 1px --border-card, radius 20px, "padding:
	 * 24px 26px 14px", heading 28px (padding-bottom 8px), rows "gap:14px;
	 * padding:13px 0", a 22px check, name 15px, quantity 14px.
	 */
	@media (min-width: 860px) {
		.ingredients {
			position: sticky;
			top: 24px;
			padding: 24px 26px 14px;
			border: 1px solid var(--border-card);
			border-radius: var(--radius-ingredients-card);
			background: var(--bg-surface);
		}

		.heading {
			padding-bottom: 8px;
			font-size: 28px;
		}

		.row {
			gap: 14px;
			padding: 13px 0;
		}

		.check {
			width: 22px;
			height: 22px;
		}

		.name {
			font-size: 15px;
		}

		.quantity {
			font-size: 14px;
		}
	}
</style>
