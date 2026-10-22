import { locales, type Locale } from '#lib/i18n/locales.ts';

// Open Graph and Twitter values shared by every page head (stage FE-8, Small
// decisions). The copy is British English, hence en_GB.
const OG_LOCALES: Record<Locale, string> = { en: 'en_GB', es: 'es_ES', ru: 'ru_RU' };
export const TWITTER_CARD = 'summary_large_image';

// `article` is the Recipe page (one recipe is a piece of content).
export type OgType = 'website' | 'article';

export function ogLocales(locale: Locale): { locale: string; alternates: string[] } {
	return {
		locale: OG_LOCALES[locale],
		alternates: locales.filter((other) => other !== locale).map((other) => OG_LOCALES[other])
	};
}
