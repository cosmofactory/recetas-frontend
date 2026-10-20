<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import SegmentedSwitch from './SegmentedSwitch.svelte';
	import { ICONS } from './icons.ts';

	// The bar sets the switch's size itself.
	type Tabs = Omit<ComponentProps<typeof SegmentedSwitch>, 'size'>;
	// code: the current locale; label: the localized "Language" message.
	// controls: the id of the language menu (FE-7) the button opens.
	type Language = {
		label: string;
		code: string;
		expanded: boolean;
		controls?: string;
		onclick: (event: MouseEvent) => void;
	};
	// search: the inline search field (FE-7); languageMenu: the menu,
	// anchored under the language button.
	type Props = {
		homeHref: string;
		tabs: Tabs;
		language: Language;
		search?: Snippet;
		languageMenu?: Snippet;
	};

	let { homeHref, tabs, language, search, languageMenu }: Props = $props();

	// Desktop prototype: the "▾" is 9px text; the chevron needs a little more to read the same.
	const CARET_ICON_PX = 12;
	const Caret = ICONS.caret;
</script>

<header class="top-bar desktop-only">
	<div class="row page-container">
		<a class="logo" href={homeHref}>Asadorov</a>
		<div class="switch">
			<SegmentedSwitch
				options={tabs.options}
				value={tabs.value}
				label={tabs.label}
				onChange={tabs.onChange}
				size="desktop"
			/>
		</div>
		<div class="spacer"></div>
		{@render search?.()}
		<div class="language">
			<button
				type="button"
				class="language-button"
				aria-expanded={language.expanded}
				aria-controls={language.controls}
				onclick={language.onclick}
			>
				<span>{language.code.toUpperCase()}</span>
				<span class="visually-hidden">{language.label}</span>
				<span class="caret" aria-hidden="true"><Caret size={CARET_ICON_PX} /></span>
			</button>
			{@render languageMenu?.()}
		</div>
	</div>
</header>

<style>
	/*
	 * Desktop README -> Top bar: "height 76px, hairline bottom border, z above
	 * content". The prototype's boxes are content-box, so the bar is 76px plus
	 * the hairline, and the language button 44px plus its border (prototype wins).
	 */
	.top-bar {
		box-sizing: content-box;
		position: relative;
		z-index: var(--z-top-bar-desktop);
		height: var(--top-bar-height-desktop);
		border-bottom: 1px solid var(--border-card);
		background: var(--bg-page);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--top-bar-gap-desktop);
		height: 100%;
	}

	/* "logo (Instrument Serif 31px, click → home)". */
	.logo {
		position: relative;
		flex: none;
		color: var(--ink);
		font: 400 31px var(--font-display);
		text-decoration: none;
	}

	.logo::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	.switch {
		flex: none;
		width: var(--switch-width-desktop);
	}

	.spacer {
		flex: 1;
	}

	/* Holds the language menu, so it anchors under the button. */
	.language {
		position: relative;
		flex: none;
	}

	/* Prototype: "height:44px;padding:0 14px 0 16px;...gap:7px;font-size:12.5px;font-weight:700;letter-spacing:.08em". */
	.language-button {
		box-sizing: content-box;
		position: relative;
		display: flex;
		align-items: center;
		gap: 7px;
		height: 44px;
		padding: 0 14px 0 16px;
		border: 1.5px solid var(--border-language-button);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink);
		font: 700 12.5px var(--font-text);
		letter-spacing: 0.08em;
		cursor: pointer;
		transition: background-color var(--dur-colour);
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
