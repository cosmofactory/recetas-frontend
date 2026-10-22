<script lang="ts">
	// A transparent full-screen layer under a dropdown (`--z-menu`) that takes
	// an outside tap while `open` and calls onclick. Pointer-only, so assistive
	// tech never sees it (Escape is the keyboard way out).
	type Props = {
		open: boolean;
		onclick: () => void;
	};

	let { open, onclick }: Props = $props();
</script>

<div class="outside-tap" class:open aria-hidden="true" {onclick}></div>

<style>
	/* Both READMEs -> Language menu: "A transparent full-screen layer behind it closes it on outside tap." */
	.outside-tap {
		position: fixed;
		inset: 0;
		z-index: var(--z-menu);
		display: none;
	}

	.outside-tap.open {
		display: block;
	}
</style>
