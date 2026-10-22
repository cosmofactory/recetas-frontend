import { describe, expect, it } from 'vitest';
import { loadNormalize, show } from '../../testutil/search';

// FE-7 PR 1, search normalisation (stage FE-7 -> Search logic; D-FE7-1).
//
// Both READMEs -> Overlay — Search: "case- and accent-insensitive substring
// match (normalise NFD, strip diacritics)". D-FE7-1 (owner, 2026-10-14)
// deviates from the design: fold ё→е but keep й distinct from и; Latin
// diacritics are still stripped. Stage order: lowercase → ё→е → NFD → strip
// combining marks except the breve on и → NFC.
//
// Decisions pinned here:
// - Module src/lib/search/normalize.ts exports normalize(s): string.
// - The result is NFC, so й comes back as the one code point U+0439 even when
//   the input spelled it decomposed (и + U+0306).
// - Every other combining mark goes, including a breve on any other letter
//   (ă → a) and a combining acute over a Cyrillic letter (а + U+0301 → а).
// - A breve on и survives even when another mark is stacked on the same и, in
//   either order (NFD sorts a dot below, U+0323, in front of the breve).
// - normalize does not trim or collapse spaces; search() trims the query.

const BREVE = '\u0306';
const ACUTE = '\u0301';
const DOT_BELOW = '\u0323';

const SAME: [string, string, string][] = [
	// [why, input, want]
	['strips the acute (stage case)', 'Andalucía', 'andalucia'],
	['lowercases Cyrillic (stage case)', 'ПАЭЛЬЯ', 'паэлья'],
	['folds ё to е (stage case)', 'ёлка', 'елка'],
	['folds upper-case Ё to е', 'ЁЛКА', 'елка'],
	['folds ё inside a word', 'печёный', 'печеный'],
	['strips the acute inside a phrase (stage case)', 'Pulpo á feira', 'pulpo a feira'],
	['strips the tilde on ñ (stage case)', 'niño', 'nino'],
	['strips the tilde on upper-case Ñ', 'CATALUÑA', 'cataluna'],
	['strips the grave', 'Pa amb tomàquet', 'pa amb tomaquet'],
	['strips the grave on o', 'Arròs negre', 'arros negre'],
	['strips the diaeresis', 'Ensaïmada', 'ensaimada'],
	['strips the cedilla', 'Façana', 'facana'],
	['strips the circumflex and acute', 'CRÈME BRÛLÉE', 'creme brulee'],
	['strips a breve that is not on и', 'Mămăligă', 'mamaliga'],
	['strips a combining acute over a Cyrillic letter', `принг${'а\u0301'}`, 'принга'],
	['strips an already decomposed accent', `Lac${'o\u0301'}n`, 'lacon'],
	['keeps й (D-FE7-1)', 'найти', 'найти'],
	['keeps й from upper-case Й (stage case)', 'ЙОГУРТ', 'йогурт'],
	['recomposes a decomposed й to one code point', `наи${BREVE}ти`, 'найти'],
	['keeps punctuation and spaces', 'Escudella i carn d’olla', 'escudella i carn d’olla'],
	['keeps the dash and spaces in Cyrillic', 'Кастилия — Ла-Манча', 'кастилия — ла-манча'],
	['leaves plain ASCII lower-case alone', 'gazpacho', 'gazpacho'],
	['keeps й with a dot below on the precomposed й', `\u0439${DOT_BELOW}`, 'й'],
	['keeps й with a dot below after the breve', `и${BREVE}${DOT_BELOW}`, 'й'],
	['keeps й with a dot below before the breve', `и${DOT_BELOW}${BREVE}`, 'й'],
	['keeps й with an acute before the breve', `и${ACUTE}${BREVE}`, 'й'],
	['returns the empty string unchanged', '', '']
];

// Pairs that must normalise to the same key (stage "matches" cases).
const MATCHING: [string, string][] = [
	['andalucia', 'Andalucía'],
	['ПАЭЛЬЯ', 'паэлья'],
	['ёлка', 'елка'],
	['pulpo a feira', 'Pulpo á feira'],
	['nino', 'niño'],
	['ЙОГУРТ', 'йогурт']
];

// Pairs that must stay different (D-FE7-1: й is its own letter).
const DISTINCT: [string, string][] = [
	['наити', 'найти'],
	['йогурт', 'иогурт'],
	['ЙОГУРТ', 'иогурт'],
	['пряныи', 'Пряный']
];

describe('normalize', () => {
	it.each(SAME)('%s: %s', async (_why, input, want) => {
		const normalize = await loadNormalize();
		const got = normalize(input);
		expect(got, `normalize(${show(input)}): got ${show(got)}, want ${show(want)}`).toBe(want);
	});

	it('returns й as the single precomposed code point U+0439', async () => {
		const normalize = await loadNormalize();
		const got = [...normalize(`И${BREVE}`)].map((c) => c.codePointAt(0)?.toString(16));
		expect(got, `got code points ${show(got)}, want ["439"]`).toEqual(['439']);
	});

	it.each(MATCHING)('%s matches %s', async (query, text) => {
		const normalize = await loadNormalize();
		const [got, want] = [normalize(query), normalize(text)];
		expect(got, `normalize(${show(query)}) = ${show(got)}, want ${show(want)}`).toBe(want);
	});

	it.each(DISTINCT)('%s does not match %s', async (query, text) => {
		const normalize = await loadNormalize();
		const [got, other] = [normalize(query), normalize(text)];
		expect(got, `normalize(${show(query)}) = ${show(got)}, must differ`).not.toBe(other);
	});
});
