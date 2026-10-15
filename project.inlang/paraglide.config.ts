import { defineConfig } from '@inlang/paraglide-js';
// settings.json (JSON, so it can't import) must list the same locales; a
// test checks it.
import { locales } from '#lib/i18n/locales.ts';

const ANY_ORIGIN = ':protocol://:domain(.*)::port?';

// Read by the Vite plugin and by `pnpm i18n:compile` alike.
// stack.md F7: the URL alone decides the locale and every locale, en too, has
// a path prefix. Paraglide never reads or writes cookies or storage.
export default defineConfig({
	outdir: './src/lib/paraglide',
	// baseLocale only answers when no URL pattern matches (a 404 under /fr/),
	// so the client never throws "No locale found"; it writes nothing.
	strategy: ['url', 'baseLocale'],
	urlPatterns: [
		{
			pattern: `${ANY_ORIGIN}/:path(.*)?`,
			localized: locales.map((locale) => [locale, `${ANY_ORIGIN}/${locale}/:path(.*)?`])
		}
	],
	isServer: 'import.meta.env.SSR'
});
