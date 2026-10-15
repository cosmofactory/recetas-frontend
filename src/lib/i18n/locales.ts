// The three site locales (stack.md F7), in language-menu order.
export const locales = ['en', 'es', 'ru'] as const;
export type Locale = (typeof locales)[number];

export const baseLocale: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

// The locale a path is in: its first segment when that is exactly en|es|ru,
// otherwise (/fr/, /healthz) the base locale.
export function localeFromPath(pathname: string): Locale {
	const first = pathname.split('/')[1];
	return isLocale(first) ? first : baseLocale;
}
