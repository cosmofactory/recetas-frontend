import { expect, type Locator, type Page } from '@playwright/test';

// The FE-8 keyboard-only path: keys only (Tab, Shift+Tab, Enter, Space,
// arrows, Escape, typing), and after every key the focus is somewhere the
// user can see: on an element, not <body>, matching :focus-visible, with a
// non-zero ring (layout.css: the shared outline, or for a map region the
// ring on its label, the documented exception).

export type FocusState = {
	what: string;
	onBody: boolean;
	focusVisible: boolean;
	ringPx: number;
};

// Read in the page: the widest solid outline on the focused element or
// inside it (the map region draws its ring on its label).
function readFocus(): FocusState {
	const el = document.activeElement;
	if (!el || el === document.body || el === document.documentElement) {
		return { what: '<body>', onBody: true, focusVisible: false, ringPx: 0 };
	}
	const ring = (node: Element) => {
		const s = getComputedStyle(node);
		return s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) || 0;
	};
	const ringPx = Math.max(ring(el), ...[...el.querySelectorAll('*')].map(ring));
	const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
	const what = `<${el.tagName.toLowerCase()}> "${name}"`;
	return { what, onBody: false, focusVisible: el.matches(':focus-visible'), ringPx };
}

export const focusState = (page: Page): Promise<FocusState> => page.evaluate(readFocus);

export async function expectVisibleFocus(page: Page, step: string) {
	const focus = await focusState(page);
	expect(focus.onBody, `after ${step}: got focus on <body>, want it on a control`).toBe(false);
	expect(focus.focusVisible, `after ${step}: got ${focus.what} not :focus-visible`).toBe(true);
	expect(focus.ringPx, `after ${step}: got no focus ring on ${focus.what}`).toBeGreaterThan(0);
}

export async function press(page: Page, key: string, step: string) {
	await page.keyboard.press(key);
	await expectVisibleFocus(page, `${step} (${key})`);
}

const isFocused = (target: Locator) =>
	target.evaluate((el) => el === document.activeElement).catch(() => false);

// The most Tab presses one step may take (the 14 map regions plus a header).
const MAX_PRESSES = 40;

// Presses `key` until `target` has focus, checking the focus after every press.
export async function tabTo(page: Page, target: Locator, what: string, key = 'Tab') {
	for (let presses = 0; presses < MAX_PRESSES; presses++) {
		await press(page, key, `${key} towards ${what}`);
		if (await isFocused(target)) return;
	}
	const focus = await focusState(page);
	throw new Error(`${key} never reached ${what} in ${MAX_PRESSES} presses; got ${focus.what}`);
}

export async function expectFocused(target: Locator, what: string) {
	await expect(target, `want focus on ${what}`).toBeFocused();
}

// A full navigation (Kit's default reset, a reload) puts focus back at the
// start of the document, as a fresh page load does; that is expected, and
// the next Tab must land on a visible control again.
export async function expectFocusAtDocumentStart(page: Page, step: string) {
	const focus = await focusState(page);
	if (focus.onBody) return;
	await expectVisibleFocus(page, step);
}

// Activates the focused link or result with Enter and waits until the page
// it was on has gone (the element is detached, or its document replaced),
// so what has focus afterwards belongs to the new page.
export async function leaveWithEnter(page: Page, step: string) {
	const left = await page.evaluateHandle(() => document.activeElement);
	await page.keyboard.press('Enter');
	const detached = () => left.evaluate((el) => !el?.isConnected).catch(() => true);
	await expect.poll(detached, { message: `want the page left after ${step}` }).toBe(true);
	await left.dispose().catch(() => undefined);
}
