import { expect, type Locator } from '@playwright/test';

// Root CLAUDE.md scope rule and FE-5 acceptance ("No variation is visually
// distinguished anywhere"): every variation of a dish is equal, so no row or
// card may be styled, marked or badged differently from its siblings.

// What a row looks like: its own box (every border side, outline,
// background) and text styles, then each descendant's tag and text styles.
// The photo subtree is left out: a real photo and its placeholder differ by
// design, and that isn't a highlight.
function looksOf(rows: Element[]): string[] {
	const SIDES = ['top', 'right', 'bottom', 'left'];
	const BORDERS = SIDES.flatMap((side) =>
		['width', 'style', 'color'].map((part) => `border-${side}-${part}`)
	);
	const BOX = [...BORDERS, 'background-color', 'background-image', 'box-shadow'];
	const OUTLINE = ['outline-style', 'outline-width', 'outline-color'];
	const TEXT = ['font-weight', 'font-size', 'font-style', 'color', 'text-decoration-line'];
	const PHOTO = 'picture, .placeholder';
	const styleOf = (el: Element, props: string[]) => {
		const style = getComputedStyle(el);
		return props.map((p) => style.getPropertyValue(p)).join(',');
	};
	const outsidePhoto = (el: Element) => !el.matches(PHOTO) && !el.closest(PHOTO);
	return rows.map((row) => {
		const own = styleOf(row, [...BOX, ...OUTLINE, ...TEXT, 'opacity', 'transform']);
		const inner = [...row.querySelectorAll('*')]
			.filter(outsidePhoto)
			.map((el) => `${el.tagName}:${styleOf(el, TEXT)}`);
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
