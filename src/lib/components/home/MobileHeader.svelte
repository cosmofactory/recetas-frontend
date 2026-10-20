<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import LanguageButton from '#lib/components/ui/LanguageButton.svelte';
	import SegmentedSwitch from '#lib/components/ui/SegmentedSwitch.svelte';

	// searchLabel: the search button's name (the overlay arrives with FE-7).
	type Props = {
		tabs: ComponentProps<typeof SegmentedSwitch>;
		language: ComponentProps<typeof LanguageButton>;
		searchLabel: string;
	};

	let { tabs, language, searchLabel }: Props = $props();
</script>

<!-- The mobile home's one heading is the logo; desktop has its own (AboutBlock). -->
<header class="mobile-header mobile-only">
	<div class="row">
		<h1 class="logo">Asadorov</h1>
		<div class="actions">
			<LanguageButton {...language} />
			<IconButton icon="search" label={searchLabel} />
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

	/* "Logo "Asadorov" — Instrument Serif 28px, ink". */
	.logo {
		margin: 0;
		color: var(--ink);
		font: 400 28px var(--font-display);
	}

	/* "Right group (flex, gap 8px): Language button, then Search button". */
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
</style>
