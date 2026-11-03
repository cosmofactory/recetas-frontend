import { afterEach, describe, expect, it } from 'vitest';
import { isLayerShownAbove, pushEscapeLayer } from './escape-layers.ts';

// isLayerShownAbove: FE-9 FB-14 lets an open search or menu take an
// empty-space click before the desktop region's `sheet` layer.

const removers: (() => void)[] = [];
const show = (kind: Parameters<typeof pushEscapeLayer>[0]) =>
	removers.push(pushEscapeLayer(kind, () => {}));

afterEach(() => {
	removers.splice(0).forEach((remove) => remove());
});

describe('isLayerShownAbove', () => {
	it('is false with no layer shown', () => {
		expect(isLayerShownAbove('sheet')).toBe(false);
	});

	it('is false with only a layer of the same kind', () => {
		show('sheet');
		expect(isLayerShownAbove('sheet')).toBe(false);
	});

	for (const kind of ['overlay', 'search', 'menu'] as const) {
		it(`is true over a sheet with a ${kind} shown`, () => {
			show('sheet');
			show(kind);
			expect(isLayerShownAbove('sheet')).toBe(true);
		});
	}

	it('is false again once the higher layer is hidden', () => {
		show('sheet');
		show('menu');
		removers.pop()!();
		expect(isLayerShownAbove('sheet')).toBe(false);
	});
});
