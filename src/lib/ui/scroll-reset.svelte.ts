// A container kept mounted while its content changes (a sheet or panel
// showing another region) would keep the old scroll offset; this puts the
// scroller back at the top whenever `key` changes. Call during component init.
export function scrollToTopOn(key: () => unknown, scroller: () => HTMLElement | undefined) {
	$effect(() => {
		key();
		const el = scroller();
		if (el) el.scrollTop = 0;
	});
}
