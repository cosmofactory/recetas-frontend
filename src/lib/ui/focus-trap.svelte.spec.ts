import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { loadUiExport, stage } from '../../testutil/ui';

// FE-3: the one focus-trap / focus-return module both sheets use
// (src/lib/ui/focus-trap.ts). Both READMEs -> Accessibility: "Sheets:
// focus-trap when expanded, Escape closes"; stage FE-3 Acceptance ->
// Keyboard: "The sheet traps focus when expanded, and Escape closes it and
// returns focus."
//
// - tabbableWithin(container): the elements Tab can reach, in DOM order.
// - trapFocus(container): moves focus inside (unless it is already there)
//   and cycles Tab / Shift+Tab inside; returns a release function that undoes
//   it. Escape is not the trap's: escape-layers.ts is the one Escape path.
// - rememberFocus(): captures the focused element now; the returned restore
//   function focuses it again (the opener), if it is still in the document.

type TrapFocus = (container: HTMLElement) => () => void;
type TabbableWithin = (container: HTMLElement) => HTMLElement[];
type RememberFocus = () => () => void;

const MODULE = 'focus-trap.ts';

const pendingReleases = new Set<() => void>();
afterEach(() => {
	pendingReleases.forEach((release) => release());
	pendingReleases.clear();
});

// trapFocus, wrapped so a trap a test leaves active is released after it
// (its listeners would otherwise act on later tests).
async function trapFocus(): Promise<TrapFocus> {
	const trap = await loadUiExport<TrapFocus>(MODULE, 'trapFocus');
	return (container) => {
		const release = trap(container);
		const once = () => {
			if (pendingReleases.delete(once)) release();
		};
		pendingReleases.add(once);
		return once;
	};
}
const tabbableWithin = () => loadUiExport<TabbableWithin>(MODULE, 'tabbableWithin');
const rememberFocus = () => loadUiExport<RememberFocus>(MODULE, 'rememberFocus');

const THREE_BUTTONS =
	'<button data-n="first">First</button><button data-n="middle">Middle</button>' +
	'<button data-n="last">Last</button>';

type Fixture = { before: HTMLElement; trap: HTMLElement; after: HTMLElement };

// A focusable "Before" button, the container (tabindex -1, as a dialog is),
// then an "After" button, so a Tab that escapes the container is visible.
function fixture(inner: string): Fixture {
	const root = stage();
	root.innerHTML =
		'<button data-n="before">Before</button>' +
		`<div data-n="trap" tabindex="-1">${inner}</div>` +
		'<button data-n="after">After</button>';
	const byName = (n: string) => root.querySelector<HTMLElement>(`[data-n="${n}"]`)!;
	return { before: byName('before'), trap: byName('trap'), after: byName('after') };
}

function named(container: HTMLElement, n: string): HTMLElement {
	return container.querySelector<HTMLElement>(`[data-n="${n}"]`)!;
}

function activeName(): string | undefined {
	return (document.activeElement as HTMLElement | null)?.dataset.n;
}

describe('tabbableWithin', () => {
	const cases: { name: string; html: string; want: string[] }[] = [
		{ name: 'buttons in DOM order', html: THREE_BUTTONS, want: ['first', 'middle', 'last'] },
		{
			name: 'links with an href only',
			html: '<a data-n="bare">Bare</a><a href="#x" data-n="link">Link</a>',
			want: ['link']
		},
		{
			name: 'form fields, but not a disabled one or a hidden input',
			html:
				'<input aria-label="Field" data-n="input"><input type="hidden" data-n="secret">' +
				'<select aria-label="Pick" data-n="select"></select>' +
				'<textarea aria-label="Notes" data-n="notes"></textarea>' +
				'<button disabled data-n="disabled">Off</button>',
			want: ['input', 'select', 'notes']
		},
		{
			name: 'tabindex 0 but not tabindex -1',
			html: '<span tabindex="0" data-n="zero">Zero</span><span tabindex="-1" data-n="minus">-1</span>',
			want: ['zero']
		},
		{
			name: 'nothing that is not rendered or is inert',
			html:
				'<button style="display: none" data-n="none">None</button>' +
				'<button style="visibility: hidden" data-n="invisible">Invisible</button>' +
				'<div inert><button data-n="inert">Inert</button></div>' +
				'<button data-n="shown">Shown</button>',
			want: ['shown']
		},
		{
			name: 'nested controls in DOM order',
			html: '<div><button data-n="a">A</button><div><button data-n="b">B</button></div></div><button data-n="c">C</button>',
			want: ['a', 'b', 'c']
		}
	];
	for (const { name, html, want } of cases) {
		it(`finds ${name}`, async () => {
			const find = await tabbableWithin();
			const got = find(fixture(html).trap).map((el) => el.dataset.n);
			expect(got).toEqual(want);
		});
	}
});

describe('trapFocus on activation', () => {
	it('moves focus to the first tabbable element when focus is outside', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		f.before.focus();
		trap(f.trap);
		expect(activeName(), 'want focus on the first control').toBe('first');
	});

	// Expanding the sheet with its handle must not pull focus off the handle.
	it('leaves focus where it is when it is already inside', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		named(f.trap, 'middle').focus();
		trap(f.trap);
		expect(activeName(), 'want focus to stay on the middle control').toBe('middle');
	});

	it('focuses the container itself when it has nothing tabbable', async () => {
		const trap = await trapFocus();
		const f = fixture('<p>Text only</p>');
		f.before.focus();
		trap(f.trap);
		expect(activeName(), 'want focus on the container').toBe('trap');
	});
});

describe('trapFocus while active', () => {
	it('moves Tab from the last element to the first', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		trap(f.trap);
		named(f.trap, 'last').focus();
		await userEvent.tab();
		expect(activeName(), 'want Tab to wrap to the first control').toBe('first');
	});

	it('moves Shift+Tab from the first element to the last', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		trap(f.trap);
		named(f.trap, 'first').focus();
		await userEvent.tab({ shift: true });
		expect(activeName(), 'want Shift+Tab to wrap to the last control').toBe('last');
	});

	it('lets Tab move normally between inner elements', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		trap(f.trap);
		named(f.trap, 'first').focus();
		await userEvent.tab();
		expect(activeName(), 'want Tab to reach the middle control').toBe('middle');
	});

	// Sheet content changes while it is open (a region's dish list loads).
	it('wraps at the current last element after content is added', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		trap(f.trap);
		f.trap.insertAdjacentHTML('beforeend', '<button data-n="added">Added</button>');
		named(f.trap, 'last').focus();
		await userEvent.tab();
		expect(activeName(), 'want Tab to reach the added control').toBe('added');
		await userEvent.tab();
		expect(activeName(), 'want Tab to wrap from the added control').toBe('first');
	});

	it('keeps Tab on the container when it has nothing tabbable', async () => {
		const trap = await trapFocus();
		const f = fixture('<p>Text only</p>');
		trap(f.trap);
		await userEvent.tab();
		expect(activeName(), 'want focus to stay in the container').toBe('trap');
	});

	// The one Escape path is escape-layers.ts, listening on the document.
	it('leaves Escape alone: not prevented, and it reaches the document', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		trap(f.trap);
		const seen: KeyboardEvent[] = [];
		const listen = (event: KeyboardEvent) => seen.push(event);
		document.addEventListener('keydown', listen);
		try {
			await userEvent.keyboard('{Escape}');
		} finally {
			document.removeEventListener('keydown', listen);
		}
		const escapes = seen.filter((event) => event.key === 'Escape');
		expect(escapes.length, 'want the Escape to reach the document').toBe(1);
		expect(escapes[0].defaultPrevented, 'got the trap preventing Escape').toBe(false);
	});
});

describe('trapFocus release', () => {
	it('lets Tab leave the container again', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		const release = trap(f.trap);
		release();
		named(f.trap, 'last').focus();
		await userEvent.tab();
		expect(activeName(), 'want Tab to reach the After button').toBe('after');
	});
});

describe('rememberFocus', () => {
	it('restores focus to the element focused when it was called (the opener)', async () => {
		const remember = await rememberFocus();
		const f = fixture(THREE_BUTTONS);
		f.before.focus();
		const restore = remember();
		named(f.trap, 'middle').focus();
		restore();
		expect(activeName(), 'want focus back on the opener').toBe('before');
	});

	it('does nothing when the opener has left the document', async () => {
		const remember = await rememberFocus();
		const f = fixture(THREE_BUTTONS);
		f.before.focus();
		const restore = remember();
		named(f.trap, 'middle').focus();
		f.before.remove();
		expect(() => restore(), 'want restore not to throw').not.toThrow();
		expect(document.activeElement, 'want focus not on the removed opener').not.toBe(f.before);
	});

	it('does not throw when nothing was focused', async () => {
		const remember = await rememberFocus();
		(document.activeElement as HTMLElement | null)?.blur();
		const restore = remember();
		expect(() => restore(), 'want restore not to throw').not.toThrow();
	});
});

// Review finding: Safari 16–17.3 lack Element.checkVisibility, and stack.md
// X10's Browserslist includes them, so visibility is decided without it.
describe('without Element.checkVisibility (Safari 16–17.3)', () => {
	let saved: PropertyDescriptor | undefined;
	beforeEach(() => {
		saved = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');
		Reflect.deleteProperty(Element.prototype, 'checkVisibility');
	});
	afterEach(() => {
		if (saved) Object.defineProperty(Element.prototype, 'checkVisibility', saved);
	});

	const cases: { name: string; html: string }[] = [
		{ name: 'display: none', html: '<button style="display: none" data-n="gone">Gone</button>' },
		{
			name: 'inside display: none',
			html: '<div style="display: none"><button data-n="gone">Gone</button></div>'
		},
		{
			name: 'visibility: hidden',
			html: '<button style="visibility: hidden" data-n="gone">Gone</button>'
		},
		{
			name: 'inside visibility: hidden',
			html: '<div style="visibility: hidden"><button data-n="gone">Gone</button></div>'
		}
	];
	for (const { name, html } of cases) {
		it(`tabbableWithin still leaves out a control with ${name}`, async () => {
			const find = await tabbableWithin();
			const trap = fixture(`${html}<button data-n="shown">Shown</button>`).trap;
			let got: (string | undefined)[] = [];
			expect(() => {
				got = find(trap).map((el) => el.dataset.n);
			}, 'got tabbableWithin throwing').not.toThrow();
			expect(got).toEqual(['shown']);
		});
	}

	it('trapFocus still moves focus in and wraps Tab', async () => {
		const trap = await trapFocus();
		const f = fixture(THREE_BUTTONS);
		f.before.focus();
		expect(() => trap(f.trap), 'got trapFocus throwing').not.toThrow();
		expect(activeName(), 'want focus on the first control').toBe('first');
		named(f.trap, 'last').focus();
		await userEvent.tab();
		expect(activeName(), 'want Tab to wrap to the first control').toBe('first');
	});
});
