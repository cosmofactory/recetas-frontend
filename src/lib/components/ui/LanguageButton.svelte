<script lang="ts">
	import { CARET_ICON_PX, ICONS } from './icons.ts';

	// code: the current locale; label: the localized "Language" message.
	// expanded / controls / haspopup / onclick / onkeydown: the language menu
	// (FE-7) it opens. size: the mobile header's or the desktop top bar's
	// button. summary: render as the <summary> of the caller's <details>,
	// which opens the menu before (or without) JavaScript.
	type Props = {
		code: string;
		label: string;
		expanded: boolean;
		controls?: string;
		haspopup?: 'menu';
		onclick?: (event: MouseEvent) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		size?: 'mobile' | 'desktop';
		summary?: boolean;
	};

	let {
		code,
		label,
		expanded,
		controls,
		haspopup,
		onclick,
		onkeydown,
		size = 'mobile',
		summary = false
	}: Props = $props();

	const Caret = ICONS.caret;
</script>

{#snippet face()}
	<span>{code.toUpperCase()}</span>
	<span class="visually-hidden">{label}</span>
	<span class="caret" aria-hidden="true"><Caret size={CARET_ICON_PX} /></span>
{/snippet}

{#if summary}
	<summary class="language-button" class:desktop={size === 'desktop'}>{@render face()}</summary>
{:else}
	<button
		type="button"
		class="language-button"
		class:desktop={size === 'desktop'}
		aria-expanded={expanded}
		aria-controls={controls}
		aria-haspopup={haspopup}
		{onclick}
		{onkeydown}
	>
		{@render face()}
	</button>
{/if}

<style>
	/*
	 * Mobile README -> Header: "height 40px, padding 0 12px 0 14px, pill,
	 * 1.5px --border-chip, 12px/700, letter-spacing .08em: current code + small
	 * ▾ (9px, opacity .55)"; the prototype adds "gap:6px" and the search
	 * button's hover. 40px is the outer height, like the IconButton beside it.
	 * The <summary> and the <button> also share the UA-dependent box and text
	 * styles, so hydration swapping one for the other shifts nothing.
	 */
	.language-button {
		position: relative;
		appearance: none;
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		height: 40px;
		margin: 0;
		padding: 0 12px 0 14px;
		border: 1.5px solid var(--border-chip);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		font: 700 12px var(--font-text);
		letter-spacing: 0.08em;
		text-align: center;
		text-indent: 0;
		text-transform: none;
		word-spacing: normal;
		cursor: pointer;
		transition: background-color var(--dur-colour);
	}

	/*
	 * Desktop prototype top bar: "height:44px;padding:0 14px 0 16px;...
	 * gap:7px;font-size:12.5px", border rgba(43,30,22,.2). Its boxes are
	 * content-box, so the button is 44px plus its border (prototype wins).
	 */
	.language-button.desktop {
		box-sizing: content-box;
		gap: 7px;
		height: 44px;
		padding: 0 14px 0 16px;
		border-color: var(--border-language-button);
		font-size: 12.5px;
	}

	/* The no-JS <summary> draws no disclosure marker. */
	summary.language-button {
		list-style: none;
	}

	summary.language-button::-webkit-details-marker {
		display: none;
	}

	.language-button::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.caret {
		display: flex;
		opacity: 0.55;
	}

	@media (hover: hover) {
		.language-button:hover {
			background: var(--bg-hover-subtle);
		}
	}
</style>
