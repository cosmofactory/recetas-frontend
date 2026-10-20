<script lang="ts">
	// A link when it navigates (href, from localizedHref), a button otherwise.
	// Prototype: "See all variations" is regular, the Filters sheet's "Show
	// results" compact.
	type Props = {
		label: string;
		href?: string;
		size?: 'regular' | 'compact';
		onclick?: (event: MouseEvent) => void;
	};

	let { label, href, size = 'regular', onclick }: Props = $props();
</script>

{#if href}
	<a class="primary" class:compact={size === 'compact'} {href} {onclick}>{label}</a>
{:else}
	<button type="button" class="primary" class:compact={size === 'compact'} {onclick}>
		{label}
	</button>
{/if}

<style>
	/* Mobile README -> Dish detail: "accent bg, --on-accent text, radius 14px, padding 15px, 14px/600". */
	.primary {
		position: relative;
		display: block;
		width: 100%;
		padding: 15px;
		border: 0;
		border-radius: var(--radius-button);
		background: var(--accent);
		color: var(--on-accent);
		font: 600 14px var(--font-text);
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	/* Prototype "Show results": "border-radius:13px;padding:14px;...font-size:13.5px". */
	.primary.compact {
		padding: 14px;
		border-radius: var(--radius-button-compact);
		font-size: 13.5px;
	}

	.primary::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.primary:hover {
			background: var(--accent-hover);
		}
	}
</style>
