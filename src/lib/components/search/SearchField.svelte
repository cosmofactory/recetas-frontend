<script lang="ts">
	import { ICONS } from '#lib/components/ui/icons.ts';
	import { m } from '#lib/paraglide/messages.js';

	// The overlay's pill field: the combobox input (stage FE-7 -> Small
	// decisions, the APG list-autocomplete combobox) and its clear "×".
	// listboxId is set only while the results show; activeId names the
	// active option.
	type Props = {
		query: string;
		input?: HTMLInputElement;
		listboxId: string | undefined;
		activeId: string | undefined;
		onInput: (query: string) => void;
		onClear: () => void;
		onKeydown: (event: KeyboardEvent) => void;
	};

	let {
		query,
		input = $bindable(),
		listboxId,
		activeId,
		onInput,
		onClear,
		onKeydown
	}: Props = $props();

	// Prototype: the magnifier is 14px; the "×" glyph 13px in a 22px circle.
	const MAGNIFIER_PX = 14;
	const CLEAR_ICON_PX = 13;
	const Magnifier = ICONS.search;
	const Clear = ICONS.close;
</script>

<div class="field" data-testid="search-field">
	<span class="magnifier" aria-hidden="true"><Magnifier size={MAGNIFIER_PX} /></span>
	<input
		bind:this={input}
		type="text"
		role="combobox"
		autocomplete="off"
		spellcheck="false"
		aria-label={m.a11y_search()}
		aria-autocomplete="list"
		aria-expanded={listboxId !== undefined}
		aria-controls={listboxId}
		aria-activedescendant={activeId}
		placeholder={m.search_placeholder()}
		value={query}
		oninput={(event) => onInput(event.currentTarget.value)}
		onkeydown={onKeydown}
	/>
	{#if query}
		<button type="button" class="clear" aria-label={m.a11y_clearSearch()} onclick={onClear}>
			<Clear size={CLEAR_ICON_PX} aria-hidden={true} />
		</button>
	{/if}
</div>

<style>
	/*
	 * Mobile README -> Overlay — Search: "field — height 46px, pill, bg
	 * surface, 1.5px --border-field, padding 0 14px, magnifier icon, input
	 * 15px/500"; the prototype's gap is 10px.
	 */
	.field {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 10px;
		box-sizing: border-box;
		height: 46px;
		padding: 0 14px;
		border: 1.5px solid var(--border-field);
		border-radius: var(--radius-pill);
		background: var(--bg-surface);
	}

	.magnifier {
		display: flex;
		flex: none;
		color: var(--ink-3);
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--ink);
		font: 500 15px var(--font-text);
	}

	input::placeholder {
		color: var(--ink-placeholder);
	}

	/* "a 22px "×" clear button appears when there's text". */
	.clear {
		position: relative;
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--bg-clear-search);
		color: var(--ink);
		cursor: pointer;
	}

	.clear::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}
</style>
