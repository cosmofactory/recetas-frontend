<script lang="ts">
	import { ICONS } from '#lib/components/ui/icons.ts';
	import type { SearchEntry } from '#lib/search/search-index.ts';

	// One result (role="option"). Focus stays in the combobox input, so the
	// option is never tabbable; `active` is its aria-activedescendant.
	type Props = { entry: SearchEntry; id: string; active: boolean; onSelect: () => void };

	let { entry, id, active, onSelect }: Props = $props();

	// Prototype: the "›" is 15px text; the icon needs a little more to read the same.
	const CHEVRON_PX = 16;
	const Chevron = ICONS.forward;
	// A region's thumb is its tile colour; dishes and variations have no
	// photo in an entry, so they keep the --placeholder stripes.
	const tileColor = $derived(entry.group === 'region' ? (entry.tileColor ?? undefined) : undefined);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events (keys stay in the combobox input: arrows and Enter) -->
<div
	{id}
	role="option"
	tabindex="-1"
	class="option"
	class:active
	aria-selected={active}
	onclick={onSelect}
>
	<span
		class="thumb"
		class:region={entry.group === 'region'}
		style:background={tileColor}
		data-testid="search-result-thumb"
	></span>
	<span class="text">
		<span class="title" data-testid="search-result-title">{entry.title}</span>
		<span class="subtitle" data-testid="search-result-subtitle">{entry.subtitle}</span>
	</span>
	<Chevron size={CHEVRON_PX} aria-hidden={true} />
</div>

<style>
	/*
	 * Prototype: "display:flex;align-items:center;gap:12px;padding:11px 0;
	 * border-bottom:1px solid rgba(43,30,22,.08)". The row reaches 8px past
	 * the text on each side so the active highlight has room; the content
	 * stays where the prototype puts it.
	 */
	.option {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-inline: -8px;
		padding: 11px 8px;
		border-bottom: 1px solid var(--border-hairline);
		/* The chevron's colour (prototype rgba(43,30,22,.35)); the text sets its own. */
		color: var(--ink-row-chevron);
		cursor: pointer;
	}

	/*
	 * The design has no active row; the keyboard's active option takes the
	 * desktop rows' hover fill, and a pointer hover the lighter header hover,
	 * so both show when they differ.
	 */
	@media (hover: hover) {
		.option:hover {
			background: var(--bg-hover-subtle);
		}
	}

	.option.active {
		background: var(--bg-surface-muted);
	}

	/* "40px thumb (radius 9px; regions 10px)". */
	.thumb {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-search-thumb);
		background: var(--placeholder);
	}

	.thumb.region {
		border-radius: var(--radius-thumb);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		color: var(--ink);
	}

	/* "title (Instrument Serif 18px)"; the prototype's line-height is 1.15. */
	.title {
		font: 400 18px / 1.15 var(--font-display);
	}

	/* "sub (11.5px ink-3, ellipsis)". */
	.subtitle {
		overflow: hidden;
		color: var(--ink-3);
		font-size: 11.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
