// FE-7 PR 3 fixtures shared by the language menu's component spec and its
// Playwright spec: plain constants only (no #lib, node: or Playwright
// imports), so both runners can load them.
//
// Sources: both READMEs -> Overlay — Language menu ("Eyebrow "LANGUAGE" in
// the current language"; "Three rows, each language in its own name:
// English · Español · Русский"; "Right side: the code …, or ✓ in accent for
// the current language"); strings.json home.language (en Language, es
// Idioma, ru Язык; the message home_language). The language names are
// endonyms, the same in every locale (prototype langOpts L1194).

export const MENU_LOCALES = ['en', 'es', 'ru'] as const;
export type MenuLocale = (typeof MENU_LOCALES)[number];

// The rows, in menu order (prototype langOpts: en, es, ru).
export const LANGUAGE_ROWS: { code: MenuLocale; name: string }[] = [
	{ code: 'en', name: 'English' },
	{ code: 'es', name: 'Español' },
	{ code: 'ru', name: 'Русский' }
];

// The eyebrow, as written in strings.json (shown upper-case by CSS).
export const MENU_EYEBROW: Record<MenuLocale, string> = {
	en: 'Language',
	es: 'Idioma',
	ru: 'Язык'
};

// The prototype's mark for the current language.
export const CURRENT_MARK = '✓';

// The menu (and the button) are named by the localized "Language"; the
// eyebrow may be upper-cased by CSS, so names compare case-insensitively.
export const menuName = (lang: MenuLocale): RegExp => new RegExp(`^${MENU_EYEBROW[lang]}$`, 'i');

// A row is named by its language (its code or ✓ may follow).
export const rowName = (name: string): RegExp => new RegExp(`^${name}(\\s|$)`);

// The /set-lang link a row points at, for a page path without its locale
// (stage FE-7: "/set-lang?to=<lang>&next=<same route and query in that
// locale>", built by setLangHref with encodeURIComponent).
export const switchHref = (to: MenuLocale, pathWithoutLocale: string): string =>
	`/set-lang?to=${to}&next=${encodeURIComponent(`/${to}${pathWithoutLocale}`)}`;
