// FE-9 FB-1, hanging short words: a no-break space where a line must not
// break, so a one- or two-letter word never ends (or starts) a line. Applied
// at render only; stored data, the search index and URLs keep plain spaces.
const NBSP = ' ';

// Short prepositions, conjunctions and particles that bind to the next word.
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
// Particles that bind to the previous word.
const RU_PREVIOUS_WORDS = ['же', 'ли', 'бы', 'ль', 'б'];
// The unit labels recipes print after a number (units_* and recipe_hours/minutes).
const RU_UNITS = ['ч. л.', 'г', 'кг', 'мл', 'л', 'ч', 'мин', 'шт'];

// A weaker convention in Spanish, applied for consistency; "que" stays free.
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
const ES_UNITS = ['cdta', 'g', 'kg', 'ml', 'l', 'L', 'h', 'min'];

// A word starts at the text start, after whitespace, an opening bracket or quote.
const WORD_START = String.raw`(?<=^|[\s(«„“"])`;
// A word ends before anything that isn't a letter or digit.
const WORD_END = String.raw`(?![\p{L}\p{N}])`;

type LocaleWords = { next: string[]; previous: string[]; units: string[] };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const alternatives = (words: string[]) => words.map(escapeRegExp).join('|');

// Each pattern matches a short span whose ASCII spaces all become NBSPs.
function compileRules({ next, previous, units }: LocaleWords): RegExp[] {
	const rules = [
		new RegExp(String.raw`${WORD_START}(?:${alternatives(next)}) (?=\S)`, 'giu'),
		new RegExp(String.raw`(?<=\p{N}) (?:${alternatives(units)})${WORD_END}`, 'gu'),
		/(?<=\S) (?=—)/gu
	];
	if (previous.length === 0) return rules;
	return [
		...rules,
		new RegExp(String.raw`(?<=\S) (?:${alternatives(previous)})${WORD_END}`, 'giu')
	];
}

const RULES_BY_LOCALE: Record<string, readonly RegExp[]> = {
	ru: compileRules({ next: RU_NEXT_WORDS, previous: RU_PREVIOUS_WORDS, units: RU_UNITS }),
	es: compileRules({ next: ES_NEXT_WORDS, previous: [], units: ES_UNITS })
};

const bindSpaces = (span: string) => span.replaceAll(' ', NBSP);

// Idempotent; a locale without rules (en) gets its text back unchanged.
export function bindShortWords(text: string, locale: string): string {
	const rules = RULES_BY_LOCALE[locale] ?? [];
	return rules.reduce((result, rule) => result.replace(rule, bindSpaces), text);
}
