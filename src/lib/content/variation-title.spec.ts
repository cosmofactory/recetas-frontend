import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Locale } from '#lib/i18n/locales.ts';
import { loadExport, repoFile } from '../../testutil/load-export';

// FE-9 FB-10 / D-FE9-6 (owner, 2026-11-02): a variation's title outside its
// dish page names the dish. Mobile README -> Region sheet row and Screen 3
// Recipe title; desktop README -> region panel rows and Recipe hero: the
// title is "{dish} · {variation}", or the variation name alone when it
// already starts with the dish name (accent- and case-insensitive, e.g.
// "Paella valenciana" under Paella). The joining pattern is a UI string
// (ICU, all three locales), not concatenation in code.
//
// Decisions pinned here:
// - Module src/lib/content/variation-title.ts exports
//   variationTitle({ dishName, variationName }, locale): string. The locale
//   is explicit so the server render and Node tests need no ambient locale.
// - The joining pattern is the message variation.fullTitle in the design
//   strings.json (Paraglide key variation_fullTitle), "{dish} · {variation}"
//   in en, es and ru.
// - "Starts with" compares both names through the one search normalisation,
//   normalize() from #lib/search/normalize.ts (Latin diacritics and case fold,
//   ё→е, й stays й, no-break spaces become spaces; D-FE7-1), never a second
//   folding of its own.
// - It must start at a word boundary: the dish name is followed by the end of
//   the variation name or by a character that is not a letter or digit (a
//   space, comma or hyphen), so "Tortillas …" under Tortilla still names the
//   dish (assumption: the READMEs give only the "Paella valenciana" case).
// - A variation that only contains the dish name later ("Arroz con leche"
//   under Leche) is prefixed: only a leading dish name makes it redundant.
// - The bare title is the variation name exactly as given (its own case and
//   accents); the joined title keeps both names as given.

type TitleParts = { dishName: string; variationName: string };
type VariationTitle = (parts: TitleParts, locale: Locale) => string;
type Message = (inputs: Record<string, string>, options: { locale: Locale }) => string;

const MODULE = 'src/lib/content/variation-title.ts';
const MESSAGE_KEY = 'variation_fullTitle';

const loadTitle = () => loadExport<VariationTitle>(MODULE, 'variationTitle');
const loadMessages = () =>
	loadExport<Record<string, Message>>('src/lib/paraglide/messages.js', 'm');

type Case = { why: string; locale: Locale; dish: string; variation: string; want: string };

const CASES: Case[] = [
	// The variation name already starts with the dish name: it alone.
	{
		why: 'starts with the dish (README case)',
		locale: 'en',
		dish: 'Paella',
		variation: 'Paella valenciana',
		want: 'Paella valenciana'
	},
	{
		why: 'starts with the dish, accented word after it',
		locale: 'es',
		dish: 'Salmorejo',
		variation: 'Salmorejo cordobés',
		want: 'Salmorejo cordobés'
	},
	{
		why: 'the accent is on the dish only (Fideuà / fideua): kept as given',
		locale: 'es',
		dish: 'Fideuà',
		variation: 'fideua de Gandia',
		want: 'fideua de Gandia'
	},
	{
		why: 'the accent is on the variation only',
		locale: 'es',
		dish: 'Fideua',
		variation: 'Fideuà de Gandia',
		want: 'Fideuà de Gandia'
	},
	{
		why: 'case differs',
		locale: 'en',
		dish: 'PAELLA',
		variation: 'paella valenciana',
		want: 'paella valenciana'
	},
	{
		why: 'a multi-word dish name',
		locale: 'es',
		dish: 'Arroz con leche',
		variation: 'Arroz con leche requemado',
		want: 'Arroz con leche requemado'
	},
	{
		why: 'the whole variation name is the dish name',
		locale: 'es',
		dish: 'Croquetas',
		variation: 'Croquetas',
		want: 'Croquetas'
	},
	{
		why: 'a comma ends the dish name',
		locale: 'es',
		dish: 'Gazpacho',
		variation: 'Gazpacho, a la antigua',
		want: 'Gazpacho, a la antigua'
	},
	{
		why: 'a no-break space follows the dish name (the page binds short words)',
		locale: 'es',
		dish: 'Paella',
		variation: 'Paella valenciana',
		want: 'Paella valenciana'
	},
	{
		why: 'starts with the dish, a space after it',
		locale: 'ru',
		dish: 'Тортилья',
		variation: 'Тортилья по-бетансосски',
		want: 'Тортилья по-бетансосски'
	},
	{
		why: 'upper-case dish name',
		locale: 'ru',
		dish: 'ТОРТИЛЬЯ',
		variation: 'Тортилья с чорисо',
		want: 'Тортилья с чорисо'
	},
	{
		why: 'ё folds to е (D-FE7-1)',
		locale: 'ru',
		dish: 'Ёрш',
		variation: 'Ерш по-донски',
		want: 'Ерш по-донски'
	},
	{
		why: 'a hyphen ends the dish name',
		locale: 'ru',
		dish: 'Тортилья',
		variation: 'Тортилья-гигант',
		want: 'Тортилья-гигант'
	},

	// The variation name does not start with the dish name: both, joined.
	{
		why: 'a bare variation name (the FB-10 case)',
		locale: 'en',
		dish: 'Croquetas',
		variation: 'De sepia',
		want: 'Croquetas · De sepia'
	},
	{
		why: 'a bare variation name',
		locale: 'es',
		dish: 'Croquetas',
		variation: 'De sepia',
		want: 'Croquetas · De sepia'
	},
	{
		why: 'an accented dish name is kept as given',
		locale: 'es',
		dish: 'Fideuà',
		variation: 'Estilo Gandia, con allioli',
		want: 'Fideuà · Estilo Gandia, con allioli'
	},
	{
		why: 'a bare variation name',
		locale: 'ru',
		dish: 'Тортилья',
		variation: 'По-бетансосски, жидкая внутри',
		want: 'Тортилья · По-бетансосски, жидкая внутри'
	},
	{
		why: 'a Russian dish over a Spanish variation name',
		locale: 'ru',
		dish: 'Крокеты',
		variation: 'De sepia',
		want: 'Крокеты · De sepia'
	},
	{
		why: 'the dish name only appears later in the variation name',
		locale: 'es',
		dish: 'Leche',
		variation: 'Arroz con leche',
		want: 'Leche · Arroz con leche'
	},
	{
		why: 'the dish name is a prefix of a longer word (not a word boundary)',
		locale: 'es',
		dish: 'Tortilla',
		variation: 'Tortillas de camarones',
		want: 'Tortilla · Tortillas de camarones'
	},
	{
		why: 'a prefix of a longer word',
		locale: 'ru',
		dish: 'Суп',
		variation: 'Супчик из фасоли',
		want: 'Суп · Супчик из фасоли'
	},
	{
		why: 'the variation name is shorter than the dish name it begins',
		locale: 'en',
		dish: 'Paella valenciana',
		variation: 'Paella',
		want: 'Paella valenciana · Paella'
	},
	{
		why: 'й is not и (D-FE7-1), so "Маионез" does not start with "Майонез"',
		locale: 'ru',
		dish: 'Майонез',
		variation: 'Маионез домашний',
		want: 'Майонез · Маионез домашний'
	},
	{
		why: 'the bundle case: a dish category over a variation that starts like it',
		locale: 'en',
		dish: 'Cocido & stews',
		variation: 'Cocido gallego',
		want: 'Cocido & stews · Cocido gallego'
	}
];

describe('variationTitle', () => {
	for (const c of CASES) {
		it(`${c.locale}: ${c.why}: "${c.dish}" + "${c.variation}" → "${c.want}"`, async () => {
			const variationTitle = await loadTitle();
			const got = variationTitle({ dishName: c.dish, variationName: c.variation }, c.locale);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(c.want)}`).toBe(c.want);
		});
	}
});

describe('the joining pattern is the variation.fullTitle message', () => {
	for (const locale of ['en', 'es', 'ru'] as const) {
		it(`${locale}: ${MESSAGE_KEY}({ dish, variation }) → "{dish} · {variation}"`, async () => {
			const message = (await loadMessages())[MESSAGE_KEY];
			expect(message, `want a Paraglide message ${MESSAGE_KEY}`).toBeTypeOf('function');
			const got = message({ dish: 'D', variation: 'V' }, { locale });
			expect(got).toBe('D · V');
		});
	}
});

describe('variation-title.ts reuses the search normalisation', () => {
	const source = () => {
		try {
			return readFileSync(repoFile(MODULE), 'utf8');
		} catch {
			return '';
		}
	};

	it("imports normalize from '#lib/search/normalize.ts'", () => {
		expect(source(), `want ${MODULE} to import the one normalize`).toMatch(
			/import\s*\{[^}]*\bnormalize\b[^}]*\}\s*from\s*'#lib\/search\/normalize\.ts'/
		);
	});

	it('does no Unicode folding of its own (no String.normalize / toLowerCase)', () => {
		const text = source();
		expect(text, `got no ${MODULE}`).not.toBe('');
		expect(text, 'got a second folding: .normalize(').not.toMatch(/\.normalize\(/);
		expect(text, 'got a second folding: toLowerCase / toLocaleLowerCase').not.toMatch(
			/to(Locale)?LowerCase\(/
		);
	});

	it('joins through the message, never a " · " literal or DOT_SEPARATOR', () => {
		const text = source();
		expect(text, `got no ${MODULE}`).not.toBe('');
		expect(text, 'got a " · " literal').not.toContain(' · ');
		expect(text, 'got DOT_SEPARATOR').not.toContain('DOT_SEPARATOR');
		expect(text, `want m.${MESSAGE_KEY}`).toContain(MESSAGE_KEY);
	});
});
