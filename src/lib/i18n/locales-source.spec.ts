import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../../testutil/load-export';

// FE-1: src/lib/i18n/locales.ts is the single list of locales. The inlang
// settings (JSON, so it cannot import) must equal it, and no other module
// may declare its own literal locale array.

const LOCALES_MODULE = 'src/lib/i18n/locales.ts';
// ['en', 'es', 'ru'] in any quote style, order or spacing.
const LOCALE_ARRAY = /\[\s*(['"`])(en|es|ru)\1\s*,\s*(['"`])(en|es|ru)\3\s*,\s*(['"`])(en|es|ru)\5/;
const IMPORTS_LOCALES = /from\s+['"][^'"]*i18n\/locales(\.ts)?['"]/;

const read = (repoPath: string) => readFileSync(repoFile(repoPath), 'utf8');

describe('project.inlang/settings.json', () => {
	const settings = () =>
		JSON.parse(read('project.inlang/settings.json')) as { locales?: unknown; baseLocale?: unknown };

	it('lists the same locales, in the same order, as locales.ts', async () => {
		const want = await loadExport<readonly string[]>(LOCALES_MODULE, 'locales');
		const got = settings().locales;
		expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual([...want]);
	});

	it('has baseLocale en, the same as locales.ts', async () => {
		const want = await loadExport<string>(LOCALES_MODULE, 'baseLocale');
		expect(want, `got locales.ts baseLocale ${want}, want en`).toBe('en');
		const got = settings().baseLocale;
		expect(got, `got ${JSON.stringify(got)}, want ${want}`).toBe(want);
	});
});

describe('no second locale list', () => {
	for (const file of ['scripts/import-strings.ts', 'project.inlang/paraglide.config.ts']) {
		it(`${file} imports the locales instead of declaring them`, () => {
			const source = read(file);
			const literal = LOCALE_ARRAY.exec(source)?.[0];
			expect(literal, `got a literal locale array ${literal} in ${file}`).toBeUndefined();
			expect(source, `got no import from i18n/locales in ${file}`).toMatch(IMPORTS_LOCALES);
		});
	}

	it('no app or script module besides locales.ts declares a literal locale array', () => {
		const offenders = [...sourceFiles('src'), ...sourceFiles('scripts')].filter(
			(file) => file !== LOCALES_MODULE && LOCALE_ARRAY.test(read(file))
		);
		expect(offenders, `got literal locale arrays in ${JSON.stringify(offenders)}`).toEqual([]);
	});
});

// Production .ts/.js/.svelte files: no tests, test helpers or generated code.
function sourceFiles(dir: string): string[] {
	const entries = readdirSync(repoFile(dir), { withFileTypes: true, recursive: true });
	return entries
		.filter((e) => e.isFile() && /\.(ts|js|svelte)$/.test(e.name))
		.map((e) => path.relative(repoFile('.'), path.join(e.parentPath, e.name)))
		.filter((f) => !/\.(spec|test|e2e)\.ts$|\/testutil\/|\/testdata\/|\/paraglide\//.test(f));
}
