import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { LANGUAGE_ROWS, type MenuLocale } from './language-menu-copy';
import { appendButton, screenFrame, settle } from './sheet';
import { loadUi } from './ui';

// Browser-mode helpers for the FE-7 PR 3 LanguageMenu spec.
//
// Contract the spec assumes: src/lib/components/ui/LanguageMenu.svelte,
// controlled like OverlaySheet / SearchOverlay. `open` shows it, `onClose`
// asks to close it (Escape, Tab, an outside tap), `opener` gets focus back
// once it closes. `lang` is the page's locale (the ✓ row), `url` the current
// page URL (the rows link to the same route and query in each locale). `id`
// is the menu element's id, for the button's aria-controls. `size` picks the
// mobile (200px) or desktop (210px) dropdown. The eyebrow comes from the
// Paraglide locale (m.home_language).

export type LanguageMenuProps = {
	id: string;
	open: boolean;
	lang: MenuLocale;
	url: URL;
	onClose: () => void;
	opener?: HTMLElement;
	size?: 'mobile' | 'desktop';
};

type RenderSpec = Partial<Pick<LanguageMenuProps, 'open' | 'lang' | 'size'>> & {
	path?: string;
	frame?: HTMLElement;
};

export const MENU_ID = 'test-language-menu';
const ORIGIN = 'http://127.0.0.1:4173';

export async function renderMenu(spec: RenderSpec = {}) {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const LanguageMenu = await loadUi<LanguageMenuProps>('LanguageMenu');
	const frame = spec.frame ?? screenFrame();
	const opener = appendButton(frame, 'Opener');
	const onClose = vi.fn();
	const url = new URL(spec.path ?? `/${lang}/`, ORIGIN);
	const props = { id: MENU_ID, open: spec.open ?? true, lang, url, onClose, opener };
	const result = await render(LanguageMenu, {
		target: frame,
		props: { ...props, size: spec.size }
	});
	settle();
	// Opens or closes and leaves the transition running.
	const startOpen = (open: boolean) => result.rerender({ open });
	const setOpen = async (open: boolean) => {
		await startOpen(open);
		settle();
	};
	return { frame, opener, onClose, startOpen, setOpen };
}

// The menu element, shown or not (role="menu" with the given id).
export function menuIn(frame: HTMLElement): HTMLElement {
	const menu = frame.querySelector<HTMLElement>(`[role="menu"]#${MENU_ID}`);
	expect(menu, `got no role="menu" with id="${MENU_ID}"`).not.toBeNull();
	return menu!;
}

export function menuItems(frame: HTMLElement): HTMLElement[] {
	return [...menuIn(frame).querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

// The row for a language code, found by its link's `to=` parameter.
export function rowFor(frame: HTMLElement, code: MenuLocale): HTMLElement {
	const row = menuItems(frame).find(
		(item) => new URL(item.getAttribute('href') ?? '', ORIGIN).searchParams.get('to') === code
	);
	expect(row, `got no menuitem linking to=${code}`).toBeDefined();
	return row!;
}

export const ROW_NAMES = LANGUAGE_ROWS.map((row) => row.name);

// The visible text of an element, as rendered (text-transform applied).
export const shownText = (el: HTMLElement): string => el.innerText.replace(/\s+/g, ' ').trim();
