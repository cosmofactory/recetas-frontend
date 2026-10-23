import { expect, type Locator } from '@playwright/test';

// Root CLAUDE.md scope rule and FE-5 acceptance ("No variation is visually
// distinguished anywhere"): every variation of a dish is equal, so no row or
// card may be styled, marked or badged differently from its siblings.

// What a row looks like: its own box styles, then each descendant's tag and
// text styles. Background images are left out: a photo (or its placeholder)
// differs per variation by design, and that isn't a highlight.
function looksOf(rows: Element[]): string[] {
	const BOX = ['background-color', 'border-bottom-color', 'border-bottom-width', 'box-shadow'];
	const TEXT = ['font-weight', 'font-size', 'font-style', 'color', 'text-decoration-line'];
	const OTHER = ['opacity', 'outline-style', 'transform'];
	const styleOf = (el: Element, props: string[]) => {
		const style = getComputedStyle(el);
		return props.map((p) => style.getPropertyValue(p)).join(',');
	};
	return rows.map((row) => {
		const own = styleOf(row, [...BOX, ...TEXT, ...OTHER]);
		const inner = [...row.querySelectorAll('*')].map((el) => `${el.tagName}:${styleOf(el, TEXT)}`);
		return [own, ...inner].join('|');
	});
}

// Attributes or elements that would single one variation out.
function markedOf(rows: Element[]): string[] {
	const MARKS = '[aria-current], [aria-selected], [data-selected], [data-active], [data-primary]';
	const EMPHASIS = 'strong, b, em, mark';
	return rows.flatMap((row, i) =>
		row.matches(MARKS) || row.querySelector(`${MARKS}, ${EMPHASIS}`) ? [`row ${i + 1}`] : []
	);
}

export async function expectNoVariationStandsOut(rows: Locator, what: string) {
	const count = await rows.count();
	expect(count, `got fewer than two ${what} to compare`).toBeGreaterThan(1);
	const looks = await rows.evaluateAll(looksOf);
	expect(new Set(looks).size, `got ${what} styled differently: ${looks.join('\n')}`).toBe(1);
	const marked = await rows.evaluateAll(markedOf);
	expect(marked, `got ${what} marked or emphasised`).toEqual([]);
}
