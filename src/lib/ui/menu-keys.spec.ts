import { describe, expect, it } from 'vitest';
import { menuItemIndex, openingFocus } from './menu-keys.ts';

// APG menu keys (stage FE-7 -> Language menu: "menu semantics with arrow-key
// navigation"). Arrows wrap at the ends; Home/End jump. `current` is -1 when
// focus is on the menu container itself rather than a row (e.g. a click on
// its padding or eyebrow): ArrowDown then goes to the first row and ArrowUp
// to the last, as when the button opens the menu with those keys.

const COUNT = 3;
const LAST = COUNT - 1;
const ON_CONTAINER = -1;

describe('menuItemIndex', () => {
	const cases: { name: string; key: string; current: number; want: number | undefined }[] = [
		{ name: 'ArrowDown moves down', key: 'ArrowDown', current: 0, want: 1 },
		{ name: 'ArrowDown wraps to the first', key: 'ArrowDown', current: LAST, want: 0 },
		{ name: 'ArrowUp moves up', key: 'ArrowUp', current: LAST, want: 1 },
		{ name: 'ArrowUp wraps to the last', key: 'ArrowUp', current: 0, want: LAST },
		{ name: 'Home jumps to the first', key: 'Home', current: LAST, want: 0 },
		{ name: 'End jumps to the last', key: 'End', current: 0, want: LAST },
		{ name: 'ArrowDown from the container', key: 'ArrowDown', current: ON_CONTAINER, want: 0 },
		{ name: 'ArrowUp from the container', key: 'ArrowUp', current: ON_CONTAINER, want: LAST },
		{ name: 'Home from the container', key: 'Home', current: ON_CONTAINER, want: 0 },
		{ name: 'End from the container', key: 'End', current: ON_CONTAINER, want: LAST },
		{ name: 'other keys move nothing', key: 'a', current: 0, want: undefined },
		{ name: 'Enter moves nothing', key: 'Enter', current: 1, want: undefined }
	];
	for (const { name, key, current, want } of cases) {
		it(`${name}: ${key} from ${current} -> ${want}`, () => {
			const got = menuItemIndex(key, current, COUNT);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}
});

describe('openingFocus', () => {
	const cases: { key: string; want: 'first' | 'last' | undefined }[] = [
		{ key: 'ArrowDown', want: 'first' },
		{ key: 'ArrowUp', want: 'last' },
		{ key: 'Enter', want: undefined },
		{ key: ' ', want: undefined }
	];
	for (const { key, want } of cases) {
		it(`"${key}" opens on ${want ?? 'nothing'}`, () => {
			expect(openingFocus(key)).toBe(want);
		});
	}
});
