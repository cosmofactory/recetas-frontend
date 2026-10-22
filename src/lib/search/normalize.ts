// Stage FE-7 -> Search logic (D-FE7-1): lowercase, fold ё→е, strip every
// combining mark except the breve on и, so й stays its own letter while
// Latin diacritics (and stray accents on Cyrillic) fold away.
const BREVE_NOT_ON_I = /(?<!и)̆/gu;
const MARK_OTHER_THAN_BREVE = /[^\P{M}̆]/gu;

export function normalize(text: string): string {
	return text
		.toLowerCase()
		.replaceAll('ё', 'е')
		.normalize('NFD')
		.replace(BREVE_NOT_ON_I, '')
		.replace(MARK_OTHER_THAN_BREVE, '')
		.normalize('NFC');
}
