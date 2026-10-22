// The three site locales (stack.md F7), in language-menu order.
export const locales = ['en', 'es', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const baseLocale: Locale = 'en';

// The language menu's rows: each language in its own name (an endonym), the
// same in every locale, so data rather than translated copy.
export const localeNames: Record<Locale, string> = {
	en: 'English',
	es: 'Español',
	ru: 'Русский'
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

// The locale a path is in: its first segment when that is exactly en|es|ru,
// otherwise (/fr/, /healthz) the base locale.
export function localeFromPath(pathname: string): Locale {
	const first = pathname.split('/')[1];
	return isLocale(first) ? first : baseLocale;
}
