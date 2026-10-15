import { baseLocale, isLocale, type Locale } from './locales.ts';

type Preference = { locale: Locale; q: number; order: number };

// "ru-RU;q=0.9" -> { locale: 'ru', q: 0.9 }; unsupported or malformed -> undefined.
function parseRange(range: string, order: number): Preference | undefined {
	const [tag, ...params] = range.split(';').map((part) => part.trim());
	const locale = tag.toLowerCase().split('-')[0];
	if (!isLocale(locale)) return undefined;
	const qParam = params.find((p) => /^q\s*=/i.test(p));
	const q = qParam === undefined ? 1 : Number(qParam.split('=')[1]);
	return Number.isFinite(q) && q > 0 ? { locale, q, order } : undefined;
}

// The best supported locale in an Accept-Language header: highest q first,
// header order on ties.
function preferredLocale(acceptLanguage: string): Locale | undefined {
	const preferences = acceptLanguage
		.split(',')
		.map(parseRange)
		.filter((p): p is Preference => p !== undefined)
		.sort((a, b) => b.q - a.q || a.order - b.order);
	return preferences[0]?.locale;
}

// The locale a bare `/` redirects to (stack.md X6): a valid `lang` cookie,
// then Accept-Language (en/es/ru), then en.
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
	if (isLocale(cookie)) return cookie;
	return preferredLocale(acceptLanguage ?? '') ?? baseLocale;
}
