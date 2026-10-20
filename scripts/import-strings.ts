// Converts the design strings.json (plus src/lib/i18n/extra-strings.json, copy
// the design lacks) into Paraglide's messages/{en,es,ru}.json (FE-1).
// Usage: node scripts/import-strings.ts <strings.json> <extra-strings.json> <outDir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { locales, type Locale } from '#lib/i18n/locales.ts';
type Messages = Record<string, unknown>;
type Strings = Record<string, unknown>;

const MESSAGE_SCHEMA = 'https://inlang.com/schema/inlang-message-format';

// strings.json paths whose arrays are plural forms, not lists.
export const PLURAL_KEYS: ReadonlySet<string> = new Set([
	'home.variation',
	'home.dish',
	'home.region'
]);

// The CLDR category of each strings.json plural form, in array order.
const PLURAL_FORMS: Record<Locale, readonly string[]> = {
	en: ['one', 'other'],
	es: ['one', 'other'],
	ru: ['one', 'few', 'many']
};

// CLDR categories strings.json has no form for, and the form they reuse
// (es `many`: 1000000; ru `other`: fractions such as 1,5).
const BORROWED_FORMS: Record<Locale, Record<string, string>> = {
	en: {},
	es: { many: 'other' },
	ru: { other: 'few' }
};

type Context = { locale: Locale; out: Messages };

// "With pork" -> "withPork", "Slow-cooked" -> "slowCooked", "L" -> "l".
function segment(name: string): string {
	const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
	if (words.length === 0) throw new Error(`strings: "${name}" has no identifier characters`);
	return words
		.map((w, i) => (i === 0 ? w[0].toLowerCase() : w[0].toUpperCase()) + w.slice(1))
		.join('');
}

function put(ctx: Context, key: string, value: unknown) {
	if (key in ctx.out) throw new Error(`strings: two ${ctx.locale} entries flatten to ${key}`);
	ctx.out[key] = value;
}

function text(value: string, where: string): string {
	if (/[{}]/.test(value)) throw new Error(`strings: ${where} contains a brace: ${value}`);
	return value;
}

function pluralMessage(ctx: Context, forms: unknown[], where: string): unknown {
	const categories = PLURAL_FORMS[ctx.locale];
	if (forms.length !== categories.length) {
		throw new Error(`strings: ${where} needs ${categories.length} ${ctx.locale} plural forms`);
	}
	const byCategory = new Map(categories.map((c, i) => [c, text(String(forms[i]), where)]));
	for (const [category, reused] of Object.entries(BORROWED_FORMS[ctx.locale])) {
		byCategory.set(category, byCategory.get(reused)!);
	}
	const match = Object.fromEntries(
		[...byCategory].map(([category, word]) => [`countPlural=${category}`, `{count} ${word}`])
	);
	return [
		{
			declarations: ['input count', 'local countPlural = count: plural'],
			selectors: ['countPlural'],
			match
		}
	];
}

function flatten(ctx: Context, value: unknown, where: string, key: string) {
	if (typeof value === 'string') return put(ctx, key, text(value, where));
	if (Array.isArray(value) && PLURAL_KEYS.has(where)) {
		return put(ctx, key, pluralMessage(ctx, value, where));
	}
	if (Array.isArray(value)) {
		return value.forEach((item, i) => flatten(ctx, item, `${where}.${i}`, `${key}_${i}`));
	}
	if (value === null || typeof value !== 'object') {
		throw new Error(`strings: ${where} in ${ctx.locale} is not a string, list or object`);
	}
	for (const [name, child] of Object.entries(value)) {
		flatten(ctx, child, `${where}.${name}`, `${key}_${segment(name)}`);
	}
}

// Top-level "_note"-style entries document the file; they are not messages.
function sections(strings: unknown): [string, Strings][] {
	return Object.entries((strings ?? {}) as Strings)
		.filter(([name]) => !name.startsWith('_'))
		.map(([name, byLocale]) => [name, (byLocale ?? {}) as Strings]);
}

function expectSameKeys(result: Record<Locale, Messages>) {
	const keys = (locale: Locale) => new Set(Object.keys(result[locale]));
	const all = new Set(locales.flatMap((l) => [...keys(l)]));
	for (const locale of locales) {
		const missing = [...all].filter((k) => !keys(locale).has(k));
		if (missing.length > 0) throw new Error(`strings: ${locale} lacks ${missing.join(', ')}`);
	}
}

function addSection(result: Record<Locale, Messages>, name: string, byLocale: Strings) {
	for (const locale of locales) {
		if (!(locale in byLocale)) throw new Error(`strings: ${name} has no ${locale} entry`);
		flatten({ locale, out: result[locale] }, byLocale[locale], name, segment(name));
	}
}

export function convertStrings(design: unknown, extra: unknown = {}): Record<Locale, Messages> {
	const result = Object.fromEntries(locales.map((l) => [l, {}])) as Record<Locale, Messages>;
	for (const [name, byLocale] of [...sections(design), ...sections(extra)]) {
		addSection(result, name, byLocale);
	}
	expectSameKeys(result);
	return result;
}

function readJson(file: string): unknown {
	return JSON.parse(readFileSync(file, 'utf8'));
}

function main(args: string[]): number {
	const [designPath, extraPath, outDir] = args;
	if (!designPath || !extraPath || !outDir) {
		console.error('usage: import-strings <strings.json> <extra-strings.json> <outDir>');
		return 2;
	}
	const messages = convertStrings(readJson(designPath), readJson(extraPath));
	mkdirSync(outDir, { recursive: true });
	for (const locale of locales) {
		const json = JSON.stringify({ $schema: MESSAGE_SCHEMA, ...messages[locale] }, null, '\t');
		writeFileSync(path.join(outDir, `${locale}.json`), `${json}\n`);
	}
	console.log(`import-strings: wrote ${locales.join(', ')} to ${outDir}`);
	return 0;
}

if (import.meta.main) {
	process.exitCode = main(process.argv.slice(2));
}
