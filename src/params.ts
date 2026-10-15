import { defineParams } from '@sveltejs/kit/params';
import { isLocale } from '#lib/i18n/locales.ts';

// [lang=lang]: exactly en|es|ru. Anything else is not a locale prefix and 404s.
export const params = defineParams({
	lang: (param: string) => (isLocale(param) ? param : undefined)
});
