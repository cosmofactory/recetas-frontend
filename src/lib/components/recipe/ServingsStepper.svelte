<script lang="ts">
	import { ICONS } from '#lib/components/ui/icons.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { clampServings, SERVINGS_MAX, SERVINGS_MIN } from '#lib/recipe/servings.ts';

	type Props = { servings: number };

	let { servings = $bindable() }: Props = $props();

	// The prototype's "−" / "+" are 16px text; the icons read the same at 14px.
	const STEP_ICON_PX = 14;
	const Minus = ICONS.minus;
	const Plus = ICONS.plus;

	// Empty until the first change, so nothing is announced on load.
	let announcement = $state('');

	function step(delta: number) {
		servings = clampServings(servings + delta);
		announcement = m.recipe_servings({ count: servings });
	}
</script>

<div class="stepper">
	<button
		type="button"
		class="step"
		aria-label={m.recipe_fewerServings()}
		disabled={servings <= SERVINGS_MIN}
		onclick={() => step(-1)}
	>
		<Minus size={STEP_ICON_PX} aria-hidden={true} />
	</button>
	<span class="value" data-testid="servings-value">{servings}</span>
	<button
		type="button"
		class="step"
		aria-label={m.recipe_moreServings()}
		disabled={servings >= SERVINGS_MAX}
		onclick={() => step(1)}
	>
		<Plus size={STEP_ICON_PX} aria-hidden={true} />
	</button>
	<span class="visually-hidden" data-testid="servings-live" aria-live="polite">{announcement}</span>
</div>

<style>
	/*
	 * Mobile README -> Screen 3 -> Info strip: "stepper: − / value / +;
	 * buttons 28px circles, 1px --border-chip"; the prototype gives the 12px
	 * gap, the 16px/600 value (min-width 14px) and the hover. The hit area
	 * grows to 44px (Accessibility).
	 */
	.stepper {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.step {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--border-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	.step::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.step:disabled {
		cursor: default;
		opacity: var(--opacity-inactive);
	}

	@media (hover: hover) {
		.step:not(:disabled):hover {
			background: var(--bg-hover-subtle);
		}
	}

	.value {
		min-width: 14px;
		font-size: 16px;
		font-weight: 600;
		text-align: center;
	}
</style>
