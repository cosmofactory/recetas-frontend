<script lang="ts">
	import { typeset } from '#lib/i18n/typeset.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Props = { tips: string[] };

	let { tips }: Props = $props();
</script>

{#if tips.length > 0}
	<section class="tips" data-testid="recipe-tips">
		<h2 class="heading">{typeset(m.recipe_tips())}</h2>
		<ul class="list" role="list">
			{#each tips as text, i (i)}
				<li class="tip"><span class="text">{typeset(text)}</span></li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	/*
	 * D-CNT2-3: tips after the method steps, under a heading. The design has
	 * no tips, so they take MethodSteps' heading, row and text styles without
	 * its number circles; the method's bottom padding is the space above.
	 */
	.tips {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0 20px 40px;
	}

	.heading {
		margin: 0;
		padding-bottom: var(--recipe-heading-padding-bottom);
		font: var(--recipe-heading-font);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tip {
		padding: var(--recipe-row-padding);
		border-bottom: 1px solid var(--border-hairline);
		color: var(--ink);
	}

	.text {
		display: block;
		font-size: var(--recipe-text-size);
		line-height: var(--recipe-text-line-height);
		text-wrap: pretty;
	}

	/* Desktop: 40px above the tips, matching the mobile method's bottom padding. */
	@media (min-width: 860px) {
		.tips,
		.list {
			gap: 0;
		}

		.tips {
			padding: 40px 0 0;
		}

		.heading {
			font-size: var(--recipe-heading-size-desktop);
		}

		.tip {
			padding: var(--recipe-row-padding-desktop);
			border-bottom-color: var(--border-card);
		}

		.text {
			max-width: var(--recipe-text-max-width-desktop);
			font-size: var(--recipe-text-size-desktop);
			line-height: var(--recipe-text-line-height-desktop);
		}
	}
</style>
