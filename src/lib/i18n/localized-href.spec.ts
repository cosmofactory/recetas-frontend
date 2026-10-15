import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-1: every internal link goes through localizedHref(path, lang), which puts
// the locale prefix in front of a locale-free app path.

type LocalizedHref = (path: string, lang: string) => string;

describe('localizedHref', () => {
	const cases: [string, string, string][] = [
		['/', 'en', '/en/'],
		['/', 'ru', '/ru/'],
		['/?tab=popular', 'es', '/es/?tab=popular'],
		['/regions/gal', 'ru', '/ru/regions/gal'],
		['/dishes/tortilla', 'es', '/es/dishes/tortilla'],
		['/dishes/tortilla/gal', 'en', '/en/dishes/tortilla/gal']
	];
	for (const [path, lang, want] of cases) {
		it(`localizedHref(${path}, ${lang}) is ${want}`, async () => {
			const localizedHref = await loadExport<LocalizedHref>(
				'src/lib/i18n/localized-href.ts',
				'localizedHref'
			);
			const got = localizedHref(path, lang);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}
});
