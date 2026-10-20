<script lang="ts">
	import { isPastThreshold } from '#lib/ui/scroll-threshold.ts';
	import { watchScroll } from '#lib/ui/scroll-position.ts';
	import { ICONS } from './icons.ts';

	type Props = {
		backHref: string;
		// The back link's accessible name (a message); the chevron is its only content.
		backLabel: string;
		title: string;
		// Mobile README: 230px on the Variations page, 280px on the Recipe page.
		threshold: number;
		// What scrolls the page; the window when absent.
		scrollContainer?: HTMLElement;
		onBack?: (event: MouseEvent) => void;
	};

	let { backHref, backLabel, title, threshold, scrollContainer, onBack }: Props = $props();

	// Mobile README -> Screen 2: back button "‹" 20px.
	const BACK_ICON_PX = 20;
	const Back = ICONS.back;

	let scrollY = $state(0);
	const past = $derived(isPastThreshold(scrollY, threshold));

	$effect(() => watchScroll(scrollContainer, (y) => (scrollY = y)));
</script>

<div class="sticky-top-bar" class:past>
	<a class="back" href={backHref} aria-label={backLabel} onclick={onBack}>
		<Back size={BACK_ICON_PX} aria-hidden={true} />
	</a>
	<!-- While faded the page's <h1> already names the page. -->
	<span class="title" aria-hidden={past ? undefined : 'true'}>{title}</span>
</div>

<style>
	/* Mobile README -> Screen 2 "Sticky top bar"; layout from the prototype. */
	.sticky-top-bar {
		position: sticky;
		top: 0;
		z-index: var(--z-top-bar);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-bottom: 1px solid transparent;
		background: var(--bg-top-bar);
		backdrop-filter: var(--blur-top-bar);
	}

	.sticky-top-bar.past {
		border-bottom-color: var(--border-card);
	}

	/* "back button 38×38 circle". */
	.back {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: var(--radius-pill);
		background: var(--bg-back-button);
		color: var(--ink);
		transition: background-color var(--dur-colour);
	}

	.back::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.back:hover {
			background: var(--bg-back-button-hover);
		}
	}

	/* "Dish name (13px/600) fades in"; one line, as in the Recipe prototype. */
	.title {
		min-width: 0;
		overflow: hidden;
		color: var(--ink);
		font: 600 13px var(--font-text);
		white-space: nowrap;
		text-overflow: ellipsis;
		opacity: 0;
		transition: opacity var(--dur-top-bar-title);
	}

	.past .title {
		opacity: 1;
	}
</style>
