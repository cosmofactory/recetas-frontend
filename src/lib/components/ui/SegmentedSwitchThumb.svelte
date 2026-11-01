<script lang="ts">
	// The switch's one active surface (FE-9 FB-3, D-FE9-2): it rests on
	// segment `index` of `count` and, while dragged, sits `offset` px right of
	// the first segment. It reads the track's --track-padding and --track-gap.
	type Props = { index: number; count: number; offset?: number };

	let { index, count, offset }: Props = $props();
</script>

<div
	class="thumb"
	class:dragging={offset !== undefined}
	style:--index={index}
	style:--count={count}
	style:transform={offset === undefined ? undefined : `translateX(${offset}px)`}
	aria-hidden="true"
	data-testid="segment-thumb"
></div>

<style>
	/* Mobile README -> Header: "Active: bg --bg-surface, radius 9px, shadow --shadow-segment-active". */
	.thumb {
		position: absolute;
		top: var(--track-padding);
		bottom: var(--track-padding);
		left: var(--track-padding);
		width: calc(
			(100% - 2 * var(--track-padding) - (var(--count) - 1) * var(--track-gap)) / var(--count)
		);
		border-radius: var(--radius-segment);
		background: var(--bg-surface);
		box-shadow: var(--shadow-segment-active);
		transform: translateX(calc(var(--index) * (100% + var(--track-gap))));
		pointer-events: none;
	}

	/* D-FE9-2: "slides ... (~250 ms, --ease)"; instant under reduced motion and while dragged. */
	@media (prefers-reduced-motion: no-preference) {
		.thumb:not(.dragging) {
			transition: transform var(--dur-segment-thumb) var(--ease);
		}
	}
</style>
