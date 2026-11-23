import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { regionHref, regionsIn, type MapRegion } from '../../testutil/map';
import { loadContent, stage, useViewport } from '../../testutil/ui';

// Region-map review item 5: on a deep link (/:lang/regions/can) the active
// region chip, the row's last, is scrolled into the row on first render
// (inline nearest), so the selection shows without a sideways swipe.

type RegionChipsProps = {
	regions: MapRegion[];
	selectedKey?: string;
	hrefFor: (key: string) => string;
};

const ROW_WIDTH_PX = 358;
const PX_TOLERANCE = 1;

async function renderSelected(selectedKey?: string): Promise<HTMLElement> {
	const RegionChips = await loadContent<RegionChipsProps>('RegionChips');
	const target = stage(`width: ${ROW_WIDTH_PX}px`);
	const props: RegionChipsProps = { regions: regionsIn('en'), hrefFor: regionHref('en') };
	await render(RegionChips, { target, props: selectedKey ? { ...props, selectedKey } : props });
	return target;
}

function rowOf(target: HTMLElement): HTMLElement {
	return target.querySelector<HTMLElement>('a[href]')!.parentElement!;
}

describe('RegionChips first render', () => {
	useViewport(390, 844);

	it('scrolls the selected last chip (Canarias) into the row', async () => {
		const target = await renderSelected('can');
		const row = rowOf(target).getBoundingClientRect();
		const chip = target.querySelector(`a[href="${regionHref('en')('can')}"]`)!;
		const box = chip.getBoundingClientRect();
		expect(box.left, 'got the chip before the row start').toBeGreaterThanOrEqual(
			row.left - PX_TOLERANCE
		);
		expect(box.right, 'got the chip past the row end').toBeLessThanOrEqual(
			row.right + PX_TOLERANCE
		);
	});

	it('leaves the row at its start with no region selected', async () => {
		const target = await renderSelected();
		expect(rowOf(target).scrollLeft).toBe(0);
	});

	it('leaves the row at its start when the selected chip is already in view', async () => {
		const target = await renderSelected('gal');
		expect(rowOf(target).scrollLeft).toBe(0);
	});
});
