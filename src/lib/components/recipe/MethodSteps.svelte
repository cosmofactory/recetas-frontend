<script lang="ts">
	import { ICONS } from '#lib/components/ui/icons.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { steps: string[] };

	let { steps }: Props = $props();

	// Mobile README -> Screen 3: a done step's circle shows "✓" for its number;
	// the prototype's ✓ is a 12.5px glyph, which the lucide icon matches at 14px.
	const CHECK_ICON_PX = 14;
	const Check = ICONS.check;

	// Done per step, in memory only (X6); the parent remounts this per recipe.
	let done = $state<boolean[]>([]);
</script>

<section class="method">
	<h2 class="heading">{m.recipe_method()}</h2>
	<ol class="steps" role="list">
		{#each steps as text, i (i)}
			<li>
				<button
					type="button"
					class="step"
					class:done={done[i]}
					data-testid="recipe-step"
					aria-pressed={done[i] ? 'true' : 'false'}
					onclick={() => (done[i] = !done[i])}
				>
					<!-- The number stays in the name once the ✓ replaces it. -->
					<span class="number" data-testid="recipe-check">
						{#if done[i]}
							<Check size={CHECK_ICON_PX} aria-hidden={true} />
							<span class="visually-hidden">{i + 1}</span>
						{:else}
							{i + 1}
						{/if}
					</span>
					<span class="text">{text}</span>
				</button>
			</li>
		{/each}
	</ol>
</section>

<style>
	/*
	 * Mobile README -> Screen 3 -> Method: "(padding 28px 20px 40px): "Method"
	 * (24px serif). Steps: 28px ink circle with the number (12.5px/700,
	 * --on-accent), text 14.5px lh 1.5. Tap toggles done: circle turns accent
	 * with ✓, row opacity 0.45"; the prototype gives the 4px list gap, the
	 * 14px row gap, padding 12px 0 with a hairline and the text's 3px top.
	 */
	.method {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 28px 20px 40px;
	}

	.heading {
		margin: 0;
		padding-bottom: 6px;
		font: 400 24px var(--font-display);
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.step {
		display: flex;
		gap: 14px;
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

	/* Done: --ink-3 text instead of the README's row opacity 0.45 (stack.md X10, FE-6). */
	.done .text {
		color: var(--ink-3);
	}

	.number {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--ink);
		color: var(--on-accent);
		font-size: 12.5px;
		font-weight: 700;
	}

	.done .number {
		background: var(--accent);
	}

	.text {
		flex: 1;
		padding-top: 3px;
		font-size: 14.5px;
		line-height: 1.5;
		text-wrap: pretty;
		transition: color var(--dur-colour);
	}
</style>
