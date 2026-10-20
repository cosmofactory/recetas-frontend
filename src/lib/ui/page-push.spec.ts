import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../../testutil/load-export';
import {
	DISH_ROUTE_ID,
	HOME_ROUTE_ID,
	navigation,
	RECIPE_ROUTE_ID,
	REGION_ROUTE_ID,
	type NavigationSpec,
	type FakeNavigation
} from '../../testutil/navigation';

// FE-3 PagePush, the direction logic (src/lib/ui/page-push.ts, pure).
// Mobile README -> Screen 2: the Variations page "pushes in from the right
// over the home (translateX 102% → 0, 420ms --ease, shadow
// --shadow-page-push)"; Screen 3: the Recipe page "pushes in over the
// Variations page with the same transition". README -> State: "route stack:
// home → variations(dishKey) → recipe(dishKey, regionKey)".
//
// pageDirection(navigation) reads the onNavigate argument and answers:
// - 'push' when the destination is deeper in that stack,
// - 'pop'  when it is shallower,
// - 'none' otherwise.
// Depth: home and a region (`/:lang/`, `/:lang/regions/:key`, the region
// sheet over the home map) are 0, a dish's Variations page is 1, a recipe 2.
// Depth decides, whatever the navigation type: back and forward buttons
// (popstate) move the same way as links. Assumption (the spec is silent): a
// popstate whose delta is negative but whose destination is deeper is a
// 'push', since the deeper page is the one that slides in from the right.
// No animation for: the initial load ('enter'), leaving the app, a
// full-document navigation (willUnload), shallow routing, a route outside the
// stack (the dev gallery, a 404), the same depth (another dish, another
// region's recipe), a locale-only switch and a query-only change
// (`?tab=popular`, filters).

type Direction = 'push' | 'pop' | 'none';
type PageDirection = (navigation: FakeNavigation) => Direction;

const MODULE = 'src/lib/ui/page-push.ts';

const HOME = '/en/';
const POPULAR = '/en/?tab=popular';
const REGION = '/en/regions/gal';
const DISH = '/en/dishes/tortilla';
const RECIPE = '/en/dishes/tortilla/gal';

type Case = NavigationSpec & { name: string; want: Direction };

const cases: Case[] = [
	// Down the stack.
	{ name: 'home → variations', from: HOME, to: DISH, want: 'push' },
	{ name: 'Popular tab → variations', from: POPULAR, to: DISH, want: 'push' },
	{ name: 'variations → recipe', from: DISH, to: RECIPE, want: 'push' },
	{ name: 'home → recipe (a search result)', from: HOME, to: RECIPE, want: 'push' },
	{ name: 'region sheet → variations', from: REGION, to: DISH, want: 'push' },
	{
		name: 'region → its recipe',
		from: '/en/regions/and',
		to: '/en/dishes/tortilla/and',
		want: 'push'
	},
	{ name: 'goto variations → recipe', type: 'goto', from: DISH, to: RECIPE, want: 'push' },
	{
		name: 'forward button home → variations',
		type: 'popstate',
		delta: 1,
		from: HOME,
		to: DISH,
		want: 'push'
	},
	{
		name: 'forward two steps home → recipe',
		type: 'popstate',
		delta: 2,
		from: HOME,
		to: RECIPE,
		want: 'push'
	},
	{
		name: 'back button to a deeper page',
		type: 'popstate',
		delta: -1,
		from: HOME,
		to: DISH,
		want: 'push'
	},

	// Up the stack.
	{ name: 'recipe → variations (back link)', from: RECIPE, to: DISH, want: 'pop' },
	{ name: 'variations → home (back link)', from: DISH, to: HOME, want: 'pop' },
	{ name: 'variations → Popular tab', from: DISH, to: POPULAR, want: 'pop' },
	{ name: 'recipe → home', from: RECIPE, to: HOME, want: 'pop' },
	{ name: 'recipe → its region (desktop back pill)', from: RECIPE, to: REGION, want: 'pop' },
	{ name: 'recipe → another dish', from: RECIPE, to: '/en/dishes/paella', want: 'pop' },
	{
		name: 'back button recipe → variations',
		type: 'popstate',
		delta: -1,
		from: RECIPE,
		to: DISH,
		want: 'pop'
	},
	{
		name: 'back button variations → home',
		type: 'popstate',
		delta: -1,
		from: DISH,
		to: HOME,
		want: 'pop'
	},
	{
		name: 'back two steps recipe → home',
		type: 'popstate',
		delta: -2,
		from: RECIPE,
		to: HOME,
		want: 'pop'
	},
	{
		name: 'back button variations → region',
		type: 'popstate',
		delta: -1,
		from: DISH,
		to: REGION,
		want: 'pop'
	},

	// Same depth.
	{ name: 'one dish → another', from: DISH, to: '/en/dishes/paella', want: 'none' },
	{
		name: 'one region’s recipe → another’s',
		from: RECIPE,
		to: '/en/dishes/tortilla/and',
		want: 'none'
	},
	{
		name: 'back button between two dishes',
		type: 'popstate',
		delta: -1,
		from: '/en/dishes/paella',
		to: DISH,
		want: 'none'
	},

	// Home and the region sheet are the same screen.
	{ name: 'home → region', from: HOME, to: REGION, want: 'none' },
	{ name: 'region → home', from: REGION, to: HOME, want: 'none' },
	{ name: 'region → region', from: REGION, to: '/en/regions/and', want: 'none' },
	{
		name: 'back button region → home',
		type: 'popstate',
		delta: -1,
		from: REGION,
		to: HOME,
		want: 'none'
	},

	// Locale-only switches (language menu).
	{ name: 'en home → es home', from: HOME, to: '/es/', want: 'none' },
	{ name: 'en variations → ru variations', from: DISH, to: '/ru/dishes/tortilla', want: 'none' },
	{ name: 'en recipe → es recipe', from: RECIPE, to: '/es/dishes/tortilla/gal', want: 'none' },
	{
		name: 'back button ru recipe → en recipe',
		type: 'popstate',
		delta: -1,
		from: '/ru/dishes/tortilla/gal',
		to: RECIPE,
		want: 'none'
	},

	// Query-only changes.
	{ name: 'Regional → Popular tab', from: HOME, to: POPULAR, want: 'none' },
	{ name: 'Popular → Regional tab', from: POPULAR, to: HOME, want: 'none' },
	{ name: 'a filter on', from: POPULAR, to: '/en/?tab=popular&course=tapas', want: 'none' },
	{
		name: 'back button: a filter off',
		type: 'popstate',
		delta: -1,
		from: '/en/?tab=popular&course=tapas',
		to: POPULAR,
		want: 'none'
	},

	// Not a page-to-page move in the stack.
	{ name: 'initial load', type: 'enter', from: null, to: DISH, want: 'none' },
	{ name: 'initial load of a recipe', type: 'enter', from: null, to: RECIPE, want: 'none' },
	{ name: 'leaving the app', type: 'leave', from: DISH, to: null, want: 'none' },
	{ name: 'a full-document navigation', from: HOME, to: DISH, willUnload: true, want: 'none' },
	{ name: 'shallow routing', from: HOME, to: DISH, shallow: true, want: 'none' },
	{ name: 'home → the dev gallery', from: HOME, to: '/en/_dev/ui', want: 'none' },
	{ name: 'the dev gallery → variations', from: '/en/_dev/ui', to: DISH, want: 'none' },
	{ name: 'home → a 404', from: HOME, to: '/en/nowhere/at/all/here', want: 'none' },
	{ name: 'a 404 → home', from: '/en/nowhere/at/all/here', to: HOME, want: 'none' }
];

describe('pageDirection', () => {
	for (const { name, want, ...spec } of cases) {
		it(`is "${want}" for ${name}`, async () => {
			const pageDirection = await loadExport<PageDirection>(MODULE, 'pageDirection');
			const got = pageDirection(navigation(spec));
			expect(got, `got "${got}", want "${want}"`).toBe(want);
		});
	}
});

// The root layout wires PagePush once for every page: it loads the
// transition styles with the other global styles and registers the
// onNavigate hook.
describe('PagePush wiring in the root layout', () => {
	const layout = () => readFileSync(repoFile('src/routes/+layout.svelte'), 'utf8');

	it('imports #lib/styles/page-push.css after layout.css', () => {
		const source = layout();
		const pushCss = source.indexOf("'#lib/styles/page-push.css'");
		expect(pushCss, 'want the root layout to import #lib/styles/page-push.css').toBeGreaterThan(-1);
		expect(pushCss, 'want page-push.css after layout.css (it uses its tokens)').toBeGreaterThan(
			source.indexOf("'#lib/styles/layout.css'")
		);
	});

	it('calls pagePush() from #lib/ui/page-push.svelte.ts', () => {
		const source = layout();
		expect(source, 'want an import from #lib/ui/page-push.svelte.ts').toMatch(
			/import\s*\{[^}]*\bpagePush\b[^}]*\}\s*from\s*'#lib\/ui\/page-push\.svelte\.ts'/
		);
		expect(source, 'want a pagePush() call').toMatch(/\bpagePush\(\s*\)/);
	});
});

// The fake navigations carry the route ids SvelteKit reports, so the depth
// table is tested against the real routes: FE-4 moved home and the region
// URL into the (home) route group (one layout keeps the header and map
// mounted), which changes their ids to /[lang=lang]/(home)….
describe('route ids the depth table is tested with', () => {
	for (const id of [HOME_ROUTE_ID, REGION_ROUTE_ID, DISH_ROUTE_ID, RECIPE_ROUTE_ID]) {
		it(`${id} is a page in src/routes`, () => {
			const file = `src/routes${id}/+page.svelte`;
			expect(existsSync(repoFile(file)), `got no ${file}, want the route's page`).toBe(true);
		});
	}

	it('the (home) group has the shared layout', () => {
		const file = `src/routes${HOME_ROUTE_ID}/+layout.svelte`;
		expect(existsSync(repoFile(file)), `got no ${file}, want the home shell layout`).toBe(true);
	});
});
