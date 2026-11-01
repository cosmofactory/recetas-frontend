// Stage FE-7 -> Search logic (D-FE7-1): lowercase, fold ё→е, strip every
// combining mark except the breve on и, so й stays its own letter while
// Latin diacritics (and stray accents on Cyrillic) fold away. Every space
// separator (the page's no-break spaces, FE-9 FB-1) becomes a plain space.
const COMBINING_BREVE = '\u0306';
// NFD orders stacked marks by combining class, so other marks can sit
// between и and its breve; the lookbehind skips over them.
const BREVE_NOT_ON_I = new RegExp(`(?<!и\\p{M}*)${COMBINING_BREVE}`, 'gu');
const SPACE_SEPARATOR = /\p{Zs}/gu;
const MARK_OTHER_THAN_BREVE = new RegExp(`[^\\P{M}${COMBINING_BREVE}]`, 'gu');

export function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(SPACE_SEPARATOR, ' ')
		.replaceAll('ё', 'е')
		.normalize('NFD')
		.replace(BREVE_NOT_ON_I, '')
		.replace(MARK_OTHER_THAN_BREVE, '')
		.normalize('NFC');
}
