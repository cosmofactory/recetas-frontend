import { describe, expect, it } from 'vitest';
import { navigation, type NavigationSpec } from '../../testutil/navigation';
import { originTab, recordOrigin, type BackOrigin } from './back-origin.ts';

// Stage FE-6 -> Small decisions (PR 4): the back pill's origin is the URL of
// the entry a page was pushed from, with the home tab it belongs to; only a
// forward push from a shallower route records one.

const cases: {
	name: string;
	spec: NavigationSpec;
	fromTab?: 'popular' | 'regional';
	want: BackOrigin | null;
}[] = [
	{
		name: 'filtered Popular → Variations',
		spec: { from: '/en/?tab=popular&f=vegetarian', to: '/en/dishes/tortilla' },
		want: { href: '/en/?tab=popular&f=vegetarian', from: 'home', tab: 'popular' }
	},
	{
		name: 'Regional home → Variations',
		spec: { from: '/es/', to: '/es/dishes/tortilla' },
		want: { href: '/es/', from: 'home', tab: 'regional' }
	},
	{
		name: 'a region page (even with ?tab=popular) → Recipe',
		spec: { from: '/en/regions/gal?tab=popular', to: '/en/dishes/tortilla/gal' },
		want: { href: '/en/regions/gal?tab=popular', from: 'home', tab: 'regional' }
	},
	{
		name: 'Variations → Recipe carries the Variations tab over',
		spec: { from: '/en/dishes/tortilla', to: '/en/dishes/tortilla/gal' },
		fromTab: 'regional',
		want: { href: '/en/dishes/tortilla', from: 'variations', tab: 'regional' }
	},
	{
		name: 'a direct load',
		spec: { type: 'enter', from: null, to: '/en/dishes/tortilla' },
		want: null
	},
	{
		name: 'Recipe → Variations (deeper)',
		spec: { from: '/en/dishes/tortilla/gal', to: '/en/dishes/tortilla' },
		want: null
	},
	{
		name: 'one recipe → another',
		spec: { from: '/en/dishes/paella/val', to: '/en/dishes/tortilla/gal' },
		want: null
	}
];

describe('recordOrigin', () => {
	for (const { name, spec, fromTab = 'popular', want } of cases) {
		it(`${name}: ${want ? want.href : 'no origin'}`, () => {
			expect(recordOrigin(navigation(spec), fromTab)).toEqual(want);
		});
	}
});

describe('originTab', () => {
	it('is Popular without an origin (a direct load)', () => {
		expect(originTab(null)).toBe('popular');
	});

	it("is the origin's tab otherwise", () => {
		expect(originTab({ href: '/en/', from: 'home', tab: 'regional' })).toBe('regional');
	});
});
