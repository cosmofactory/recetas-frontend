<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import LanguageButton from '#lib/components/ui/LanguageButton.svelte';
	import SegmentedSwitch from '#lib/components/ui/SegmentedSwitch.svelte';

	// homeHref: the start page the logo links to (D-FE9-7, as on desktop);
	// search: the button that opens the search overlay (FE-7); languageMenu:
	// the menu the language button opens, inside the <details> that opens it
	// without JavaScript (language.summary).
	type SearchButton = { label: string; expanded: boolean; onclick: (event: MouseEvent) => void };
	type Props = {
		homeHref: string;
		tabs: ComponentProps<typeof SegmentedSwitch>;
		language: ComponentProps<typeof LanguageButton>;
		search: SearchButton;
		languageMenu?: Snippet;
	};

	let { homeHref, tabs, language, search, languageMenu }: Props = $props();
</script>

<!-- The logo isn't a heading: the page's one <h1> is the about title (AboutBlock, D-FE9-4). -->
<header class="mobile-header mobile-only">
	<div class="row">
		<a class="logo" href={homeHref}>Asadorov</a>
		<div class="actions">
			<svelte:element this={language.summary ? 'details' : 'div'} class="language">
				<LanguageButton {...language} />
				{@render languageMenu?.()}
			</svelte:element>
			<IconButton
				icon="search"
				label={search.label}
				haspopup="dialog"
				expanded={search.expanded}
				onclick={search.onclick}
			/>
		</div>
	</div>
	<SegmentedSwitch
		options={tabs.options}
		value={tabs.value}
		label={tabs.label}
		onChange={tabs.onChange}
	/>
</header>

<style>
	/* Mobile README -> Screen 1 -> Header: "padding 22px 20px 0, column, gap 16px". */
	.mobile-header {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 16px;
		padding: 22px 20px 0;
	}

	/* "Row, space-between, centred vertically". */
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	/* "Logo "Asadorov" — Instrument Serif 28px, ink. It links to the start page" (D-FE9-7). */
	.logo {
		position: relative;
		color: var(--ink);
		font: 400 28px var(--font-display);
		text-decoration: none;
	}

	/* The 44px target (FE-8) without moving the logo, as on desktop. */
	.logo::before {
		content: '';
		position: absolute;
		inset: var(--hit-inset);
	}

	/* "Right group (flex, gap 8px): Language button, then Search button". */
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.language {
		display: flex;
	}
</style>
