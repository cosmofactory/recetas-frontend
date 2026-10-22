<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import ServingsStepper from './ServingsStepper.svelte';

	type Props = { time: string; servings: number };

	let { time, servings = $bindable() }: Props = $props();
</script>

<div class="info-strip">
	<div class="cell">
		<span class="label">{m.recipe_time()}</span>
		<span class="time" data-testid="recipe-time">{time}</span>
	</div>
	<div class="cell">
		<span class="label">{m.recipe_serves()}</span>
		<ServingsStepper bind:servings />
	</div>
</div>

<style>
	/*
	 * Mobile README -> Screen 3 -> Info strip: "margin 18px 20px 0, 1px
	 * rgba(43,30,22,.12) border, radius 14px, bg surface), two equal cells
	 * split by a hairline", "eyebrow + value (16px/600)"; the prototype gives
	 * the cells' padding 12px 14px and gap 3px, the hairline
	 * rgba(43,30,22,.1) and the eyebrow (10px/700, .1em, ink at .5, here the
	 * --ink-3 AA override).
	 */
	.info-strip {
		display: flex;
		margin: 18px 20px 0;
		border: 1px solid var(--border-info-strip);
		border-radius: var(--radius-info-strip);
		background: var(--bg-surface);
	}

	.cell {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 3px;
		padding: 12px 14px;
	}

	.cell + .cell {
		border-left: 1px solid var(--border-card);
	}

	.label {
		color: var(--ink-3);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.time {
		font-size: 16px;
		font-weight: 600;
	}
</style>
