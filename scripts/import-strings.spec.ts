import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../src/testutil/load-export';
import { EXPECTED_MESSAGE_KEYS, EXTRA_MESSAGE_KEYS, pluralMessage } from './testdata/message-keys';

// scripts/import-strings.ts (FE-1) converts the design strings.json, merged
// with src/lib/i18n/extra-strings.json (same per-locale shape; copy the
// design lacks, e.g. error pages), into Paraglide's messages/{en,es,ru}.json.
// The key contract lives in testdata/message-keys.ts.

type Locale = 'en' | 'es' | 'ru';
type Messages = Record<Locale, Record<string, unknown>>;
type ConvertStrings = (design: unknown, extra?: unknown) => Messages;

const LOCALES: Locale[] = ['en', 'es', 'ru'];
const SCRIPT = 'scripts/import-strings.ts';
const designPath = repoFile('../design/design_handoff_asadorov_desktop/strings.json');
const haveDesign = existsSync(designPath);
const extraPath = repoFile('src/lib/i18n/extra-strings.json');

const loadConvert = () => loadExport<ConvertStrings>(SCRIPT, 'convertStrings');

function messageKeys(messages: Record<string, unknown>): string[] {
	return Object.keys(messages)
		.filter((k) => k !== '$schema')
		.sort();
}

// A small strings.json with every shape the real file has.
function sampleDesign() {
	return {
		_note: 'Not a message.',
		home: {
			en: {
				regional: 'Regional',
				regionsCount: '14 regions',
				variation: ['variation', 'variations'],
				dish: ['dish', 'dishes'],
				filterLabels: { Vegetarian: 'Vegetarian', 'With pork': 'With pork', 'Slow-cooked': 'Slow' }
			},
			es: {
				regional: 'Regional',
				regionsCount: '14 regiones',
				variation: ['variante', 'variantes'],
				dish: ['plato', 'platos'],
				filterLabels: {
					Vegetarian: 'Vegetariano',
					'With pork': 'Con cerdo',
					'Slow-cooked': 'Lenta'
				}
			},
			ru: {
				regional: 'По регионам',
				regionsCount: '14 регионов',
				variation: ['вариант', 'варианта', 'вариантов'],
				dish: ['блюдо', 'блюда', 'блюд'],
				filterLabels: {
					Vegetarian: 'Вегетарианское',
					'With pork': 'Со свининой',
					'Slow-cooked': 'Долго'
				}
			}
		},
		search: {
			en: { groups: ['Dishes', 'Variations', 'Regions'] },
			es: { groups: ['Platos', 'Variantes', 'Regiones'] },
			ru: { groups: ['Блюда', 'Варианты', 'Регионы'] }
		},
		units: {
			en: { L: 'L', tsp: 'tsp' },
			es: { L: 'L', tsp: 'cdta' },
			ru: { L: 'л', tsp: 'ч. л.' }
		}
	};
}

const SAMPLE_KEYS = [
	'home_dish',
	'home_filterLabels_slowCooked',
	'home_filterLabels_vegetarian',
	'home_filterLabels_withPork',
	'home_regional',
	'home_regionsCount',
	'home_variation',
	'search_groups_0',
	'search_groups_1',
	'search_groups_2',
	'units_l',
	'units_tsp'
];

describe('PLURAL_KEYS', () => {
	// home.region is extra-strings.json's (FE-4 regions eyebrow).
	it('lists exactly the plural arrays: home.variation, home.dish and home.region', async () => {
		const keys = await loadExport<Iterable<string>>(SCRIPT, 'PLURAL_KEYS');
		const got = [...keys].sort();
		expect(got, `got ${JSON.stringify(got)}`).toEqual([
			'home.dish',
			'home.region',
			'home.variation'
		]);
	});
});

describe('convertStrings on a sample', () => {
	it('returns one message object per locale, en, es and ru', async () => {
		const got = Object.keys((await loadConvert())(sampleDesign())).sort();
		expect(got, `got locales ${JSON.stringify(got)}, want en, es, ru`).toEqual(['en', 'es', 'ru']);
	});

	for (const locale of LOCALES) {
		it(`flattens ${locale} keys into identifier-safe section_path names`, async () => {
			const got = messageKeys((await loadConvert())(sampleDesign())[locale]);
			expect(got, `got ${JSON.stringify(got)}`).toEqual(SAMPLE_KEYS);
		});
	}

	const plain: [Locale, string, string][] = [
		['en', 'home_regional', 'Regional'],
		['ru', 'home_regional', 'По регионам'],
		['es', 'home_regionsCount', '14 regiones'],
		['en', 'home_filterLabels_withPork', 'With pork'],
		['es', 'home_filterLabels_withPork', 'Con cerdo'],
		['ru', 'home_filterLabels_slowCooked', 'Долго'],
		['ru', 'home_filterLabels_vegetarian', 'Вегетарианское'],
		['es', 'units_tsp', 'cdta'],
		['ru', 'units_tsp', 'ч. л.'],
		['ru', 'units_l', 'л']
	];
	for (const [locale, key, want] of plain) {
		it(`copies the ${locale} string ${key} verbatim`, async () => {
			const got = (await loadConvert())(sampleDesign())[locale][key];
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	const lists: [Locale, string, string][] = [
		['en', 'search_groups_0', 'Dishes'],
		['en', 'search_groups_2', 'Regions'],
		['es', 'search_groups_1', 'Variantes'],
		['ru', 'search_groups_2', 'Регионы']
	];
	for (const [locale, key, want] of lists) {
		it(`turns a plain list into indexed keys: ${locale} ${key}`, async () => {
			const got = (await loadConvert())(sampleDesign())[locale][key];
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	const plurals: [Locale, string, Record<string, string>][] = [
		['en', 'home_variation', { one: 'variation', other: 'variations' }],
		['en', 'home_dish', { one: 'dish', other: 'dishes' }],
		['es', 'home_variation', { one: 'variante', other: 'variantes' }],
		['es', 'home_dish', { one: 'plato', other: 'platos' }],
		['ru', 'home_variation', { one: 'вариант', few: 'варианта', many: 'вариантов' }],
		['ru', 'home_dish', { one: 'блюдо', few: 'блюда', many: 'блюд' }]
	];
	for (const [locale, key, forms] of plurals) {
		it(`turns ${locale} ${key} into a plural message on ${Object.keys(forms).join('/')}`, async () => {
			const got = (await loadConvert())(sampleDesign())[locale][key];
			expectPluralMessage(got, forms);
		});
	}

	it('rejects two segments that flatten to the same key', async () => {
		const design = sampleDesign();
		for (const locale of LOCALES) {
			(design.home[locale].filterLabels as Record<string, string>).withPork = 'duplicate';
		}
		const convert = await loadConvert();
		expect(() => convert(design), 'got no error for a key collision, want one').toThrow();
	});

	it('rejects a plural array with the wrong number of forms for its locale', async () => {
		const design = sampleDesign();
		design.home.ru.variation = ['вариант', 'вариантов'];
		const convert = await loadConvert();
		expect(() => convert(design), 'got no error for 2 Russian forms, want one').toThrow();
	});

	it('rejects a string that is missing in one locale instead of dropping it', async () => {
		const design = sampleDesign();
		delete (design.units.es as Partial<typeof design.units.es>).tsp;
		const convert = await loadConvert();
		expect(() => convert(design), 'got no error for a missing es key, want one').toThrow();
	});
});

function sampleExtra() {
	return {
		errors: {
			en: { notFoundTitle: 'Page not found', serverErrorTitle: 'Something went wrong' },
			es: { notFoundTitle: 'Página no encontrada', serverErrorTitle: 'Algo salió mal' },
			ru: { notFoundTitle: 'Страница не найдена', serverErrorTitle: 'Что-то пошло не так' }
		}
	};
}

describe('convertStrings with extra strings', () => {
	for (const locale of LOCALES) {
		it(`adds the extra keys to the design keys in ${locale}`, async () => {
			const got = messageKeys((await loadConvert())(sampleDesign(), sampleExtra())[locale]);
			const want = [...SAMPLE_KEYS, 'errors_notFoundTitle', 'errors_serverErrorTitle'].sort();
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});
	}

	const plain: [Locale, string, string][] = [
		['en', 'errors_notFoundTitle', 'Page not found'],
		['es', 'errors_notFoundTitle', 'Página no encontrada'],
		['ru', 'errors_serverErrorTitle', 'Что-то пошло не так']
	];
	for (const [locale, key, want] of plain) {
		it(`copies the extra ${locale} string ${key} verbatim`, async () => {
			const got = (await loadConvert())(sampleDesign(), sampleExtra())[locale][key];
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toBe(want);
		});
	}

	it('rejects an extra key that collides with a design key', async () => {
		const extra = {
			...sampleExtra(),
			home: { en: { regional: 'A' }, es: { regional: 'B' }, ru: { regional: 'C' } }
		};
		const convert = await loadConvert();
		const run = () => convert(sampleDesign(), extra);
		expect(run, 'got no error for home.regional in both files, want one').toThrow();
	});

	it('rejects an extra string missing in one locale', async () => {
		const extra = sampleExtra();
		delete (extra.errors.ru as Partial<typeof extra.errors.ru>).notFoundTitle;
		const convert = await loadConvert();
		expect(() => convert(sampleDesign(), extra), 'got no error, want one').toThrow();
	});
});

describe('src/lib/i18n/extra-strings.json', () => {
	for (const locale of LOCALES) {
		it(`holds the pinned error-page keys in ${locale}`, async () => {
			const extra = readJson(extraPath);
			const got = messageKeys((await loadConvert())({}, extra)[locale]);
			const missing = EXTRA_MESSAGE_KEYS.filter((k) => !got.includes(k));
			expect(missing, `got missing keys ${JSON.stringify(missing)}, want none`).toEqual([]);
		});
	}

	// FE-4 meta row: "14 REGIONS" counts the API's regions, so it is a plural
	// (the design's home.regionsCount is the fixed string "14 regions").
	const regionForms: [Locale, Record<string, string>][] = [
		['en', { one: 'region', other: 'regions' }],
		['es', { one: 'región', other: 'regiones' }],
		['ru', { one: 'регион', few: 'региона', many: 'регионов' }]
	];
	for (const [locale, forms] of regionForms) {
		it(`turns the extra ${locale} home.region into a plural message`, async () => {
			const got = (await loadConvert())({}, readJson(extraPath))[locale].home_region;
			expectPluralMessage(got, forms);
		});
	}
});

// The design bundle is a workspace sibling, absent in a bare CI checkout.
describe.skipIf(!haveDesign)('convertStrings on the design strings.json', () => {
	const design = () => JSON.parse(readFileSync(designPath, 'utf8')) as unknown;

	for (const locale of LOCALES) {
		it(`produces exactly the contracted keys in ${locale}`, async () => {
			const got = messageKeys((await loadConvert())(design())[locale]);
			const want = [...EXPECTED_MESSAGE_KEYS].sort();
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});

		it(`keeps every ${locale} design string (no string dropped)`, async () => {
			const out = messageTexts((await loadConvert())(design())[locale]);
			const missing = designLeaves(design(), locale).filter((s) => !out.has(s));
			expect(missing, `got missing strings ${JSON.stringify(missing)}, want none`).toEqual([]);
		});
	}

	it('merges the committed extra strings without a collision', async () => {
		const merged = (await loadConvert())(design(), readJson(extraPath));
		for (const locale of LOCALES) {
			const got = messageKeys(merged[locale]);
			const missing = [...EXPECTED_MESSAGE_KEYS, ...EXTRA_MESSAGE_KEYS].filter(
				(k) => !got.includes(k)
			);
			expect(missing, `got missing ${locale} keys ${JSON.stringify(missing)}`).toEqual([]);
		}
	});

	it('the CLI writes messages/{en,es,ru}.json equal to convertStrings', async () => {
		const want = (await loadConvert())(design(), readJson(extraPath));
		const outDir = mkdtempSync(path.join(tmpdir(), 'import-strings-'));
		try {
			runCli([designPath, extraPath, outDir]);
			for (const locale of LOCALES) {
				const got = readJson(path.join(outDir, `${locale}.json`));
				expect(withoutSchema(got), `got a different ${locale}.json`).toEqual(want[locale]);
			}
		} finally {
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});

// node scripts/import-strings.ts <strings.json> <extra-strings.json> <outDir>
function runCli(args: string[]) {
	try {
		execFileSync('node', [repoFile(SCRIPT), ...args], { encoding: 'utf8', stdio: 'pipe' });
	} catch (err) {
		const e = err as { status?: number; stderr?: string };
		expect.fail(`got exit ${e.status} from ${SCRIPT}, want 0: ${e.stderr ?? String(err)}`);
	}
}

type Variant = { declarations?: unknown; selectors?: unknown; match?: Record<string, string> };

// The design's forms must be there exactly. Extra CLDR categories are allowed
// (es `many` must render the `other` form), as long as they reuse a design form.
function expectPluralMessage(got: unknown, forms: Record<string, string>) {
	const [want] = pluralMessage(forms) as Variant[];
	expect(Array.isArray(got) && got.length === 1, `got ${JSON.stringify(got)}, want 1 variant`).toBe(
		true
	);
	const [variant] = got as Variant[];
	expect(variant.declarations, 'got different declarations').toEqual(want.declarations);
	expect(variant.selectors, 'got different selectors').toEqual(want.selectors);
	const match = variant.match ?? {};
	for (const [k, v] of Object.entries(want.match!)) {
		expect(match[k], `got ${k} = ${JSON.stringify(match[k])}, want ${JSON.stringify(v)}`).toBe(v);
	}
	const allowed = Object.values(want.match!);
	const extras = Object.entries(match).filter(([k]) => !(k in want.match!));
	const odd = extras.filter(([, v]) => !allowed.includes(v));
	expect(odd, `got extra categories with new text ${JSON.stringify(odd)}`).toEqual([]);
}

function readJson(file: string): Record<string, unknown> {
	expect(existsSync(file), `got no file at ${file}, want one`).toBe(true);
	return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function withoutSchema(messages: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(messages).filter(([k]) => k !== '$schema'));
}

// Every text a converted locale holds; plural forms without their "{count} ".
function messageTexts(messages: Record<string, unknown>): Set<string> {
	const texts = new Set<string>();
	for (const value of Object.values(messages)) {
		for (const text of textsOf(value)) texts.add(text.replace(/^\{count\} /, ''));
	}
	return texts;
}

function textsOf(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(textsOf);
	if (value && typeof value === 'object') {
		const v = value as { match?: Record<string, unknown> };
		return v.match ? Object.values(v.match).flatMap(textsOf) : [];
	}
	return [];
}

// Every leaf string under <section>.<locale> in strings.json.
function designLeaves(design: unknown, locale: Locale): string[] {
	const sections = Object.entries(design as Record<string, unknown>).filter(([k]) => k !== '_note');
	return sections.flatMap(([, section]) => leaves((section as Record<string, unknown>)[locale]));
}

function leaves(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(leaves);
	if (value && typeof value === 'object') return Object.values(value).flatMap(leaves);
	return [];
}
