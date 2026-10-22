import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigation, type FakeNavigation, type NavigationSpec } from '../../testutil/navigation';
import { inAppBack } from './in-app-back.ts';

// Stage FE-6 -> Small decisions: the Variations back button keeps its href
// (the direct-entry fallback); after hydration, when the previous history
// entry is an in-app page, a plain click goes history.back() instead, so
// home returns with its exact URL and scroll (D-FE6-1).
//
// FE-6 PR 2 review: "the previous entry is in-app" may only be recorded for
// a forward PUSH from a shallower route, classified by the one direction
// rule (pageDirection / ROUTE_DEPTH in #lib/ui/page-push.ts). Going back
// there means going UP the route stack. A link or goto from a deeper route
// (Recipe → its Variations back link, PR 3) or from the same depth (one
// dish → another) leaves it false: history.back() would return to that
// recipe or dish, not up, so the button must follow its href. The initial
// load has no previous entry. A popstate keeps what the entry had (the
// entry snapshot restores it), so it never sets the flag itself.

const afterNavigateCallbacks = vi.hoisted(() => [] as ((nav: FakeNavigation) => void)[]);
vi.mock('$app/env', () => ({ browser: false, dev: false, building: false }));
vi.mock('$app/navigation', () => ({
	afterNavigate: (callback: (nav: FakeNavigation) => void) => afterNavigateCallbacks.push(callback),
	snapshot: vi.fn()
}));

const HOME = '/en/';
const POPULAR_SHEET = '/en/?tab=popular&dish=tortilla';
const REGION = '/en/regions/gal';
const DISH = '/en/dishes/tortilla';
const OTHER_DISH = '/en/dishes/paella';
const RECIPE = '/en/dishes/tortilla/gal';
const OTHER_RECIPE = '/en/dishes/paella/val';

const back = vi.fn();

beforeEach(() => {
	afterNavigateCallbacks.length = 0;
	back.mockReset();
	vi.stubGlobal('history', { back });
});

afterEach(() => vi.unstubAllGlobals());

type Click = { event: MouseEvent; prevented: () => boolean };

function plainClick(): Click {
	let prevented = false;
	const event = {
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		preventDefault: () => (prevented = true)
	} as unknown as MouseEvent;
	return { event, prevented: () => prevented };
}

// A back button that has seen these navigations, in order, then is clicked.
function clickAfter(...specs: NavigationSpec[]): { wentBack: boolean; prevented: boolean } {
	const onBack = inAppBack('test-back');
	const afterNavigate = afterNavigateCallbacks.at(-1);
	expect(afterNavigate, 'want inAppBack to register an afterNavigate callback').toBeDefined();
	for (const spec of specs) afterNavigate!(navigation(spec));
	const click = plainClick();
	onBack(click.event);
	return { wentBack: back.mock.calls.length > 0, prevented: click.prevented() };
}

const ENTER: NavigationSpec = { type: 'enter', from: null, to: DISH };

describe('inAppBack: a push from a shallower route goes back in history', () => {
	const pushes: { name: string; spec: NavigationSpec }[] = [
		{ name: 'link home → Variations', spec: { type: 'link', from: HOME, to: DISH } },
		{ name: 'link dish sheet → Variations', spec: { type: 'link', from: POPULAR_SHEET, to: DISH } },
		{ name: 'goto dish sheet → Variations', spec: { type: 'goto', from: POPULAR_SHEET, to: DISH } },
		{ name: 'link region → Variations', spec: { type: 'link', from: REGION, to: DISH } }
	];
	for (const { name, spec } of pushes) {
		it(`${name}: history.back() and the href is not followed`, () => {
			const got = clickAfter({ type: 'enter', from: null, to: HOME }, spec);
			expect(got, 'want history.back() with the default prevented').toEqual({
				wentBack: true,
				prevented: true
			});
		});
	}
});

describe('inAppBack: anything else follows the href', () => {
	const others: { name: string; specs: NavigationSpec[] }[] = [
		{ name: 'a direct entry', specs: [ENTER] },
		{
			name: 'link Recipe → its Variations (from deeper)',
			specs: [
				{ type: 'enter', from: null, to: RECIPE },
				{ type: 'link', from: RECIPE, to: DISH }
			]
		},
		{
			name: 'goto Recipe → its Variations (from deeper)',
			specs: [
				{ type: 'enter', from: null, to: RECIPE },
				{ type: 'goto', from: RECIPE, to: DISH }
			]
		},
		{
			name: 'link another recipe → Variations (from deeper)',
			specs: [
				{ type: 'enter', from: null, to: OTHER_RECIPE },
				{ from: OTHER_RECIPE, to: DISH }
			]
		},
		{
			name: 'link one dish → another (same depth)',
			specs: [
				{ type: 'enter', from: null, to: OTHER_DISH },
				{ from: OTHER_DISH, to: DISH }
			]
		},
		{
			// The page stays mounted from one dish to the next, so it sees both.
			name: 'a push, then one dish → another (the later navigation decides)',
			specs: [
				{ type: 'enter', from: null, to: HOME },
				{ from: HOME, to: OTHER_DISH },
				{ from: OTHER_DISH, to: DISH }
			]
		}
	];
	for (const { name, specs } of others) {
		it(`${name}: no history.back(), the default is not prevented`, () => {
			const got = clickAfter(...specs);
			expect(got, 'want the link to follow its href').toEqual({
				wentBack: false,
				prevented: false
			});
		});
	}
});

describe('inAppBack: popstate never records the flag itself', () => {
	it('a direct entry, then a popstate from deeper: still follows the href', () => {
		const got = clickAfter(ENTER, { type: 'popstate', delta: -1, from: RECIPE, to: DISH });
		expect(got.wentBack, 'got history.back() after a popstate').toBe(false);
	});

	it('a push, then a popstate back from Recipe: still goes back', () => {
		const got = clickAfter(
			{ type: 'enter', from: null, to: HOME },
			{ from: HOME, to: DISH },
			{ type: 'popstate', delta: -1, from: RECIPE, to: DISH }
		);
		expect(got.wentBack, 'want the push recorded before the popstate kept').toBe(true);
	});
});
