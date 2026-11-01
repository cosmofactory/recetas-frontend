import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoFile } from '../../testutil/load-export';

// FE-9 FB-1: typeset() is for visible text only. Accessible names and other
// attribute text (aria-label, a container's `label` prop that becomes its
// aria-label, title, alt, placeholder) stay the plain message, so assistive
// tech, tooltips and the search field never get a no-break space.
//
// Why a source scan: today's messages passed as labels ("Фильтры",
// "Filtros") have no short word, so a rendered check couldn't fail; a label
// with one would silently gain an NBSP. FiltersSheet's OverlaySheet label is
// the case found in review.

const LABEL_ATTRIBUTES = ['label', 'aria-label', 'title', 'alt', 'placeholder'];
const TYPESET_IN_LABEL = new RegExp(
	String.raw`(?<![\w-])(${LABEL_ATTRIBUTES.join('|')})=\{[^}]*\btypeset\(`,
	'g'
);

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return svelteFiles(full);
		return entry.name.endsWith('.svelte') ? [full] : [];
	});
}

function typesetLabels(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	const relative = path.relative(repoFile('.'), file);
	return [...source.matchAll(TYPESET_IN_LABEL)].map((match) => `${relative}: ${match[0]}`);
}

describe('typeset() never reaches an accessible name or attribute text', () => {
	it('no label, aria-label, title, alt or placeholder is typeset', () => {
		const found = svelteFiles(repoFile('src')).flatMap(typesetLabels);
		expect(found, `got typeset label text: ${JSON.stringify(found, null, 1)}`).toEqual([]);
	});

	it('the scan sees a typeset label (positive control)', () => {
		const sample = '<OverlaySheet {open} label={typeset(m.home_filters())}>';
		expect([...sample.matchAll(TYPESET_IN_LABEL)]).toHaveLength(1);
	});
});
