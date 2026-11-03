import { afterEach, describe, expect, it } from 'vitest';
import '../../testutil/ui';

// Owner, 2026-11-03: "when I click for example on language change or on
// search, I again see the blue box ... We want mobile app experience, so no
// blue hyperlink box highlights". global.css sets it once on <html>; the
// property is inherited, so every control — present and future — gets it.

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const CONTROLS: { name: string; html: string }[] = [
	{ name: 'a link', html: '<a href="/en/">Home</a>' },
	{ name: 'a button', html: '<button type="button">Language</button>' },
	{ name: 'a search input', html: '<input type="search" />' },
	{ name: 'a label', html: '<label>Vegetarian <input type="checkbox" /></label>' },
	{ name: 'a role=button element', html: '<div role="button" tabindex="0">Sheet handle</div>' },
	{
		name: 'a nested link',
		html: '<nav><ul><li><a href="/en/dishes/tortilla">Tortilla</a></li></ul></nav>'
	}
];

let host: HTMLElement | undefined;
afterEach(() => host?.remove());

function mount(html: string): HTMLElement {
	host = document.createElement('div');
	host.innerHTML = html;
	document.body.append(host);
	return host;
}

describe('tap highlight (FE-9, app-wide)', () => {
	it.each(CONTROLS)('$name shows no tap flash', ({ html }) => {
		const root = mount(html);
		for (const el of root.querySelectorAll<HTMLElement>('*')) {
			const highlight = getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color');
			expect(highlight, `<${el.tagName.toLowerCase()}>`).toBe(TRANSPARENT);
		}
	});
});
