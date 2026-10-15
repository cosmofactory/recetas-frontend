import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1 / stack.md X6: a bare `/` picks the locale from the `lang` cookie (if
// it is exactly en|es|ru), then a quality-weighted Accept-Language, then en.

type PickLocale = (cookie: string | undefined, acceptLanguage: string | null) => string;

const load = () => loadExport<PickLocale>('src/lib/i18n/pick-locale.ts', 'pickLocale');

describe('pickLocale', () => {
	const cases: { name: string; cookie: string | undefined; accept: string | null; want: string }[] =
		[
			{ name: 'nothing at all', cookie: undefined, accept: null, want: 'en' },
			{ name: 'empty header', cookie: undefined, accept: '', want: 'en' },
			// Cookie first.
			{ name: 'cookie es beats Accept-Language ru', cookie: 'es', accept: 'ru', want: 'es' },
			{ name: 'cookie ru, no header', cookie: 'ru', accept: null, want: 'ru' },
			{ name: 'cookie en beats Accept-Language es', cookie: 'en', accept: 'es-ES', want: 'en' },
			{ name: 'invalid cookie xx is ignored', cookie: 'xx', accept: 'ru', want: 'ru' },
			{ name: 'invalid cookie xx, no header', cookie: 'xx', accept: null, want: 'en' },
			{ name: 'empty cookie is ignored', cookie: '', accept: 'es', want: 'es' },
			{ name: 'upper-case cookie ES is not a valid value', cookie: 'ES', accept: 'ru', want: 'ru' },
			{
				name: 'cookie with a region is not a valid value',
				cookie: 'es-ES',
				accept: null,
				want: 'en'
			},
			// Accept-Language.
			{ name: 'ru-RU,ru;q=0.9', cookie: undefined, accept: 'ru-RU,ru;q=0.9', want: 'ru' },
			{ name: 'de-DE only', cookie: undefined, accept: 'de-DE', want: 'en' },
			{ name: 'plain es', cookie: undefined, accept: 'es', want: 'es' },
			{ name: 'es-419 region variant', cookie: undefined, accept: 'es-419', want: 'es' },
			{ name: 'case-insensitive tag', cookie: undefined, accept: 'RU-ru', want: 'ru' },
			{
				name: 'unsupported first, es later',
				cookie: undefined,
				accept: 'de-DE,de;q=0.9,es;q=0.8',
				want: 'es'
			},
			{
				name: 'en preferred over ru',
				cookie: undefined,
				accept: 'en-US,en;q=0.9,ru;q=0.8',
				want: 'en'
			},
			{
				name: 'en ranks above ru behind an unsupported language',
				cookie: undefined,
				accept: 'fr-CA,fr;q=0.9,en;q=0.8,ru;q=0.7',
				want: 'en'
			},
			{
				name: 'higher q wins regardless of order',
				cookie: undefined,
				accept: 'es;q=0.5,ru;q=0.8',
				want: 'ru'
			},
			{ name: 'q=1.0 written out', cookie: undefined, accept: 'es;q=0.9,ru;q=1.0', want: 'ru' },
			{ name: 'q=0 means not acceptable', cookie: undefined, accept: 'ru;q=0', want: 'en' },
			{
				name: 'q=0 is skipped for the next',
				cookie: undefined,
				accept: 'ru;q=0,es;q=0.1',
				want: 'es'
			},
			{ name: 'tie keeps header order (es first)', cookie: undefined, accept: 'es,ru', want: 'es' },
			{
				name: 'tie keeps header order (ru first)',
				cookie: undefined,
				accept: 'ru;q=0.8,es;q=0.8',
				want: 'ru'
			},
			{
				name: 'whitespace around tags and params',
				cookie: undefined,
				accept: ' ru-RU ; q=0.9 , es ;q=0.95',
				want: 'es'
			},
			{ name: 'wildcard only', cookie: undefined, accept: '*', want: 'en' },
			{ name: 'a tag that only starts with ru', cookie: undefined, accept: 'rus', want: 'en' },
			{ name: 'garbage header', cookie: undefined, accept: ';;,;q=,', want: 'en' }
		];
	for (const tc of cases) {
		it(`${tc.name} -> ${tc.want}`, async () => {
			const pickLocale = await load();
			const got = pickLocale(tc.cookie, tc.accept);
			expect(got, `got ${got}, want ${tc.want}`).toBe(tc.want);
		});
	}
});
