import { describe, expect, it } from 'vitest';
import { isPlainClick } from './plain-click.ts';

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('isPlainClick', () => {
	it('a primary click with no modifier is plain', () => {
		expect(isPlainClick(plain)).toBe(true);
	});

	const others = [
		{ name: 'middle button', event: { ...plain, button: 1 } },
		{ name: 'meta (new tab on macOS)', event: { ...plain, metaKey: true } },
		{ name: 'ctrl (new tab)', event: { ...plain, ctrlKey: true } },
		{ name: 'shift (new window)', event: { ...plain, shiftKey: true } },
		{ name: 'alt (download)', event: { ...plain, altKey: true } }
	];
	for (const tc of others) {
		it(`${tc.name} is not`, () => {
			expect(isPlainClick(tc.event)).toBe(false);
		});
	}
});
