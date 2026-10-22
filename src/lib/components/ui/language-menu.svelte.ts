import type { ComponentProps } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import type { Locale } from '#lib/i18n/locales.ts';
import type { PageLocation } from '#lib/i18n/set-lang.ts';
import { m } from '#lib/paraglide/messages.js';
import { desktopQuery } from '#lib/ui/breakpoints.ts';
import { openingFocus, type MenuFocus } from '#lib/ui/menu-keys.ts';
import type LanguageButton from './LanguageButton.svelte';
import type LanguageMenu from './LanguageMenu.svelte';

type Layout = 'mobile' | 'desktop';

// Unique per layout: the home renders the mobile header and the desktop top
// bar together, each with its own menu.
const MENU_IDS: Record<Layout, string> = {
	mobile: 'language-menu-mobile',
	desktop: 'language-menu-desktop'
};

// One header's language button and menu (APG menu button). The menu is in
// memory; the server renders the button as a <summary> (LanguageButton
// `summary`) so the menu opens without JavaScript, with plain links for
// rows; hydration swaps in the real button and the menu roles. The menu
// closes when its header is hidden by the 860px switch. Create during
// component init.
export class LanguageMenuState {
	hydrated = $state(false);
	open = $state(false);
	opener: HTMLElement | undefined = $state();
	focus: MenuFocus = $state('first');
	readonly #layout: Layout;

	constructor(layout: Layout) {
		this.#layout = layout;
		const desktop = new MediaQuery(desktopQuery, false);
		$effect.pre(() => {
			if (desktop.current !== (layout === 'desktop')) this.open = false;
		});
		$effect(() => {
			this.hydrated = true;
		});
	}

	button(lang: Locale): ComponentProps<typeof LanguageButton> {
		return {
			code: lang,
			label: m.home_language(),
			expanded: this.open,
			controls: MENU_IDS[this.#layout],
			haspopup: 'menu',
			summary: !this.hydrated,
			onclick: this.#toggle,
			onkeydown: this.#openFromKey
		};
	}

	menu(lang: Locale, url: PageLocation): ComponentProps<typeof LanguageMenu> {
		return {
			id: MENU_IDS[this.#layout],
			open: this.open,
			lang,
			url,
			onClose: this.#close,
			opener: this.opener,
			size: this.#layout,
			initialFocus: this.focus,
			hydrated: this.hydrated
		};
	}

	#show(event: Event, focus: MenuFocus) {
		if (event.currentTarget instanceof HTMLElement) this.opener = event.currentTarget;
		this.focus = focus;
		this.open = true;
	}

	// A click, Enter or Space; while open the outside-tap layer covers the
	// button, so a second click closes through the menu instead.
	#toggle = (event: MouseEvent) => {
		if (this.open) return this.#close();
		this.#show(event, 'first');
	};

	#openFromKey = (event: KeyboardEvent) => {
		const focus = openingFocus(event.key);
		if (!focus) return;
		event.preventDefault();
		this.#show(event, focus);
	};

	#close = () => {
		this.open = false;
	};
}
