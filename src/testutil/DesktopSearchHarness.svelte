<script lang="ts">
	import type { Component } from 'svelte';
	import type { SearchEntry } from '#lib/search/search-index.ts';
	import type { DesktopSearchProps } from './desktop-search';

	// Test harness (FE-7 PR 4): owns `open` the way a screen does, so the
	// controlled DesktopSearch opens and closes on its own requests; the
	// spies see every request. The component comes in as a prop (loaded by
	// the spec), so a missing component fails as an assertion, not at import.
	type Props = {
		DesktopSearch: Component<DesktopSearchProps>;
		initialOpen: boolean;
		index: SearchEntry[];
		onOpen: () => void;
		onClose: () => void;
		onSelect: (entry: SearchEntry) => void;
	};

	let { DesktopSearch, initialOpen, index, onOpen, onClose, onSelect }: Props = $props();

	// svelte-ignore state_referenced_locally (only the first value seeds the state)
	let open = $state(initialOpen);

	function requestOpen() {
		open = true;
		onOpen();
	}

	function requestClose() {
		open = false;
		onClose();
	}
</script>

<DesktopSearch {open} {index} onOpen={requestOpen} onClose={requestClose} {onSelect} />
