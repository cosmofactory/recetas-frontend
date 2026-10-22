<script lang="ts">
	// Mobile README: "Clear all" is 12px/600 (small), search "Cancel" 14px/600;
	// medium is the same 12px below 860px and grows more than small on
	// desktop. `inactive` (aria-disabled) dims it and ignores presses but
	// keeps it focusable, so focus never drops when it turns inactive.
	type Props = {
		label: string;
		href?: string;
		size?: 'regular' | 'small' | 'medium';
		inactive?: boolean;
		onclick?: (event: MouseEvent) => void;
	};

	let { label, href, size = 'regular', inactive = false, onclick }: Props = $props();

	function handleClick(event: MouseEvent) {
		if (!inactive) return onclick?.(event);
		event.preventDefault();
	}
</script>

{#if href}
	<a
		class="text-button"
		class:small={size === 'small'}
		class:medium={size === 'medium'}
		aria-disabled={inactive || undefined}
		{href}
		onclick={handleClick}>{label}</a
	>
{:else}
	<button
		type="button"
		class="text-button"
		class:small={size === 'small'}
		class:medium={size === 'medium'}
		aria-disabled={inactive || undefined}
		onclick={handleClick}
	>
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

	.text-button.small,
	.text-button.medium {
		font-size: 12px;
	}

	/* Desktop prototype: the sidebar's "Clear all" 12.5px/600, the empty state's 13px/600. */
	@media (min-width: 860px) {
		.text-button.small {
			font-size: 12.5px;
		}

		.text-button.medium {
			font-size: 13px;
		}
	}

	/* Desktop prototype: "Clear all" at "opacity: 0.4" while nothing is active. */
	.text-button[aria-disabled='true'] {
		opacity: var(--opacity-inactive);
		cursor: default;
	}

	.text-button::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	@media (hover: hover) {
		.text-button:not([aria-disabled='true']):hover {
			color: var(--accent-text-hover);
		}
	}
</style>
