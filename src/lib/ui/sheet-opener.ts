// The link that opened a URL-driven sheet (a region, a dish), by the key it
// opened. WebKit doesn't focus a link on click, so the sheet can't learn its
// opener from focus; a cold load records nothing, so nothing is focused.
export function sheetOpener() {
	let last: { key: string; link: HTMLElement } | undefined;
	return {
		remember: (key: string, link: HTMLElement) => {
			last = { key, link };
		},
		forKey: (key: string | undefined): HTMLElement | undefined =>
			last !== undefined && last.key === key ? last.link : undefined
	};
}
