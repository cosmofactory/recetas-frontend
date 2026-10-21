<script lang="ts">
	// Mobile README: "Clear all" is 12px/600 (small), search "Cancel" 14px/600.
	type Props = {
		label: string;
		href?: string;
		size?: 'regular' | 'small';
		onclick?: (event: MouseEvent) => void;
	};

	let { label, href, size = 'regular', onclick }: Props = $props();
</script>

{#if href}
	<a class="text-button" class:small={size === 'small'} {href} {onclick}>{label}</a>
{:else}
	<button type="button" class="text-button" class:small={size === 'small'} {onclick}>
		{label}
	</button>
{/if}

<style>
	.text-button {
		position: relative;
		display: inline-block;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--accent-text);
		font: 600 14px var(--font-text);
		text-decoration: none;
		cursor: pointer;
		transition: color var(--dur-colour);
	}

	.text-button.small {
		font-size: 12px;
	}

	.text-button::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.text-button:hover {
			color: var(--accent-text-hover);
		}
	}
</style>
