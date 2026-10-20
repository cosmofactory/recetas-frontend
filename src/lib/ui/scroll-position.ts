// Reports the vertical scroll position of `container` (the window when none)
// now and on every scroll; returns the cleanup.
export function watchScroll(
	container: HTMLElement | undefined,
	onScroll: (scrollY: number) => void
): () => void {
	const target: HTMLElement | Window = container ?? window;
	const report = () => onScroll(container ? container.scrollTop : window.scrollY);
	report();
	target.addEventListener('scroll', report, { passive: true });
	return () => target.removeEventListener('scroll', report);
}
