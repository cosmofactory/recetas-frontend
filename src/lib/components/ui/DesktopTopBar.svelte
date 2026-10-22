<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import LanguageButton from './LanguageButton.svelte';
	import SegmentedSwitch from './SegmentedSwitch.svelte';

	// The bar sets the switch's and the language button's size itself.
	type Tabs = Omit<ComponentProps<typeof SegmentedSwitch>, 'size'>;
	type Language = Omit<ComponentProps<typeof LanguageButton>, 'size'>;
	// search: the inline search field (FE-7); languageMenu: the menu,
	// anchored under the language button, inside the <details> that opens it
	// without JavaScript (language.summary).
	type Props = {
		homeHref: string;
		tabs: Tabs;
		language: Language;
		search?: Snippet;
		languageMenu?: Snippet;
	};

	let { homeHref, tabs, language, search, languageMenu }: Props = $props();
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
				activation={tabs.activation}
				size="desktop"
			/>
		</div>
		<div class="spacer"></div>
		{@render search?.()}
		<svelte:element this={language.summary ? 'details' : 'div'} class="language">
			<LanguageButton {...language} size="desktop" />
			{@render languageMenu?.()}
		</svelte:element>
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
</style>
