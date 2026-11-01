import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-9 FB-1, hanging short words: bindShortWords(text, locale) puts a
// no-break space (U+00A0) where a line must not break, so a one- or
// two-letter word never ends a line (ru "…в Каталонии и⏎Галисии").
//
// Sources:
// - Stage FE-9 -> FB-1: ru binds short prepositions, conjunctions and
//   particles to the next word, же/ли/бы to the previous word, numbers to
//   units, and a dash to the word before it; es the same mechanism for its
//   short words; en unchanged. Stored data and search stay raw.
//
// Decisions pinned here (assumptions where FB-1 lists "…"):
// - ru next-word list: в во и с со к ко о об у а я на по за из от до не ни
//   но да; previous-word list: же ли бы ль б.
// - es next-word list: y e o u a de en el la lo al del con por sin un una
//   los las su se; "que" is not bound.
// - Only a single ASCII space between the two words is replaced; a newline
//   is never bound across.
// - Words match whole words only, in any case, also right after "(" or «.
// - Number + unit: the units the recipes print (ru г кг мл л ч мин шт ч. л.;
//   es g kg ml l L h min cdta), with an integer or decimal-comma number, or
//   a half as quantity.ts writes it ("1½", "½", no space before the ½). The
//   space inside "ч. л." is bound too, so the tsp label never splits.
// - A word followed by " —" gets the NBSP before the dash.

type BindShortWords = (text: string, locale: string) => string;

const MODULE = 'src/lib/i18n/typography.ts';
const NBSP = ' ';
const load = () => loadExport<BindShortWords>(MODULE, 'bindShortWords');

// `_` marks where the NBSP goes, so the tables stay readable.
const bound = (text: string) => text.replaceAll('_', NBSP);

type Row = { why: string; input: string; want: string };

const RU_NEXT_WORDS = [
	'в',
	'во',
	'и',
	'с',
	'со',
	'к',
	'ко',
	'о',
	'об',
	'у',
	'а',
	'я',
	'на',
	'по',
	'за',
	'из',
	'от',
	'до',
	'не',
	'ни',
	'но',
	'да'
];
const RU_PREVIOUS_WORDS = ['же', 'ли', 'бы', 'ль', 'б'];

const ES_NEXT_WORDS = [
	'y',
	'e',
	'o',
	'u',
	'a',
	'de',
	'en',
	'el',
	'la',
	'lo',
	'al',
	'del',
	'con',
	'por',
	'sin',
	'un',
	'una',
	'los',
	'las',
	'su',
	'se'
];

const capitalised = (word: string) => word[0].toUpperCase() + word.slice(1);

function nextWordRows(words: string[], [lead, next]: [string, string]): Row[] {
	return words.flatMap((w) => [
		{
			why: `"${w}" mid-sentence`,
			input: `${lead} ${w} ${next}`,
			want: bound(`${lead} ${w}_${next}`)
		},
		{
			why: `"${capitalised(w)}" at sentence start`,
			input: `${capitalised(w)} ${next}`,
			want: bound(`${capitalised(w)}_${next}`)
		},
		{ why: `"${w}" after "("`, input: `(${w} ${next})`, want: bound(`(${w}_${next})`) },
		{ why: `"${w}" after «`, input: `«${w} ${next}»`, want: bound(`«${w}_${next}»`) }
	]);
}

const RU_ROWS: Row[] = [
	...nextWordRows(RU_NEXT_WORDS, ['Это', 'Галисии']),
	...RU_PREVIOUS_WORDS.map((w) => ({
		why: `"${w}" binds to the previous word, not the next`,
		input: `Пришёл ${w} гость`,
		want: bound(`Пришёл_${w} гость`)
	})),
	{
		why: 'the reported sentence',
		input: 'Это блюдо популярно в Каталонии и Галисии',
		want: bound('Это блюдо популярно в_Каталонии и_Галисии')
	},
	{ why: 'consecutive short words', input: 'и в Галисии', want: bound('и_в_Галисии') },
	{
		why: 'the about copy: consecutive short words after a comma',
		input: 'готовят по-своему, и у каждого варианта есть свой рецепт.',
		want: bound('готовят по-своему, и_у_каждого варианта есть свой рецепт.')
	},
	{ why: 'upper case word', input: 'НА ОГНЕ', want: bound('НА_ОГНЕ') },
	{
		why: 'em dash: the NBSP goes before it',
		input: 'Одно блюдо — два века споров. С луком или без — это только начало.',
		want: bound('Одно блюдо_— два века споров. С_луком или без_— это только начало.')
	},
	{ why: 'number + г', input: 'Нужно 200 г муки', want: bound('Нужно 200_г муки') },
	{ why: 'number + кг', input: '1 кг', want: bound('1_кг') },
	{ why: 'number + мл', input: '250 мл', want: bound('250_мл') },
	{ why: 'decimal number + л', input: '1,5 л', want: bound('1,5_л') },
	{ why: 'number + ч', input: '2 ч', want: bound('2_ч') },
	{ why: 'number + мин', input: '45 мин', want: bound('45_мин') },
	{ why: 'hours and minutes', input: '1 ч 15 мин', want: bound('1_ч 15_мин') },
	{ why: 'number + шт', input: '3 шт', want: bound('3_шт') },
	{ why: 'number + ч. л. (tsp)', input: '1 ч. л.', want: bound('1_ч._л.') },
	{ why: 'number + unit before a period', input: 'Нужно 200 г.', want: bound('Нужно 200_г.') },
	{ why: '1½ + ч. л. (quantity.ts)', input: '1½ ч. л. соли', want: bound('1½_ч._л. соли') },
	{ why: '½ + ч. л. (quantity.ts)', input: '½ ч. л. соли', want: bound('½_ч._л. соли') },
	{ why: '½ + кг', input: '½ кг', want: bound('½_кг') },
	{ why: '2½ + ч', input: '2½ ч', want: bound('2½_ч') },
	{ why: '1½ + шт', input: 'Добавьте 1½ шт', want: bound('Добавьте 1½_шт') },
	{
		why: 'a recipe step: prepositions and the negation',
		input: 'Томите в масле на слабом огне, до мягкости, не обжаривая.',
		want: bound('Томите в_масле на_слабом огне, до_мягкости, не_обжаривая.')
	},
	{
		why: 'a region description',
		input: 'Косидо в три подачи, таверны и бутерброд с кальмарами.',
		want: bound('Косидо в_три подачи, таверны и_бутерброд с_кальмарами.')
	},
	{ why: 'a word that starts with и', input: 'Ивановка', want: 'Ивановка' },
	{ why: 'a word that ends with в', input: 'Лев Толстой', want: 'Лев Толстой' },
	{ why: 'a word that ends with из', input: 'низ дома', want: 'низ дома' },
	{ why: 'a longer word not in the list', input: 'чай или кофе', want: 'чай или кофе' },
	{ why: 'a hyphenated word', input: 'по-своему готовят', want: 'по-своему готовят' },
	{ why: 'a short word at the end', input: 'Слово и', want: 'Слово и' },
	{ why: 'never across a newline', input: 'в\nГалисии', want: 'в\nГалисии' },
	{ why: 'never a dash after a newline', input: 'блюдо\n— два', want: 'блюдо\n— два' },
	{ why: 'empty string', input: '', want: '' }
];

const ES_ROWS: Row[] = [
	...nextWordRows(ES_NEXT_WORDS, ['Pulpo', 'Galicia']),
	{
		why: 'the about copy',
		input: 'cada región lo cocina a su manera, y cada variante tiene su propia receta.',
		want: bound('cada región lo_cocina a_su_manera, y_cada variante tiene su_propia receta.')
	},
	{ why: 'consecutive short words', input: 'y en Galicia', want: bound('y_en_Galicia') },
	{
		why: 'em dash: the NBSP goes before it',
		input: 'Caldoso — se come con cuchara',
		want: bound('Caldoso_— se_come con_cuchara')
	},
	{ why: 'number + g', input: '200 g', want: bound('200_g') },
	{ why: 'number + kg', input: '1 kg', want: bound('1_kg') },
	{ why: 'number + ml', input: '250 ml', want: bound('250_ml') },
	{ why: 'decimal number + l', input: '1,5 l', want: bound('1,5_l') },
	{ why: 'decimal number + L (the units.l label)', input: '1,5 L', want: bound('1,5_L') },
	{ why: 'number + h', input: '2 h', want: bound('2_h') },
	{ why: 'number + min', input: '45 min', want: bound('45_min') },
	{ why: 'number + cdta (tsp)', input: '1 cdta', want: bound('1_cdta') },
	{ why: '1½ + cdta (quantity.ts)', input: '1½ cdta de sal', want: bound('1½_cdta de_sal') },
	{ why: '½ + cdta', input: '½ cdta', want: bound('½_cdta') },
	{ why: '½ + kg', input: '½ kg', want: bound('½_kg') },
	{ why: '2½ + h', input: '2½ h', want: bound('2½_h') },
	{ why: '"que" is not bound', input: 'Dice que sí', want: 'Dice que sí' },
	{ why: 'a word that starts with a', input: 'Avila', want: 'Avila' },
	{ why: 'a word that starts with Á', input: 'Ávila y León', want: bound('Ávila y_León') },
	{ why: 'a word that starts with con', input: 'Contigo pan', want: 'Contigo pan' },
	{ why: 'a word that starts with en', input: 'Enero frío', want: 'Enero frío' },
	{ why: 'never across a newline', input: 'de\nGalicia', want: 'de\nGalicia' },
	{ why: 'empty string', input: '', want: '' }
];

// en is the identity, for its own text and for text with ru/es short words.
const EN_ROWS: Row[] = [
	'Pick a region to see its dishes, or follow one dish across the country.',
	'Soupy — spooned, not forked',
	'200 g',
	'1.5 L',
	'25 min',
	'a b c',
	'в Галисии',
	'y en Galicia',
	''
].map((text) => ({ why: 'unchanged', input: text, want: text }));

const ROWS_BY_LOCALE: Record<string, Row[]> = { ru: RU_ROWS, es: ES_ROWS, en: EN_ROWS };

const show = (s: string) => JSON.stringify(s).replaceAll(NBSP, '⍽');

for (const [locale, rows] of Object.entries(ROWS_BY_LOCALE)) {
	describe(`bindShortWords(${locale})`, () => {
		for (const { why, input, want } of rows) {
			it(`${why}: ${show(input)} -> ${show(want)}`, async () => {
				const got = (await load())(input, locale);
				expect(got, `got ${show(got)}, want ${show(want)}`).toBe(want);
			});
		}
	});

	describe(`bindShortWords(${locale}) properties`, () => {
		for (const { input } of rows) {
			it(`is idempotent on ${show(input)}`, async () => {
				const bindShortWords = await load();
				const once = bindShortWords(input, locale);
				const twice = bindShortWords(once, locale);
				expect(twice, `got ${show(twice)} on the second pass, want ${show(once)}`).toBe(once);
			});

			it(`only turns spaces into NBSPs in ${show(input)}`, async () => {
				const got = (await load())(input, locale);
				const restored = got.replaceAll(NBSP, ' ');
				expect(restored, `got ${show(got)}, which differs beyond spaces`).toBe(input);
			});
		}
	});
}
