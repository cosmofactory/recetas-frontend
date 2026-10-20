// Mobile README -> State: "route stack: home → variations(dishKey) →
// recipe(dishKey, regionKey)". A move deeper in the stack pushes the new
// page in from the right; a move back up pops the top page off. The region
// sheet sits over the home map, so a region shares the home's depth.

export type PageDirection = 'push' | 'pop' | 'none';

type RouteTarget = { route: { id: string | null } } | null;

// The parts of SvelteKit's onNavigate argument the direction depends on.
export type PageNavigation = {
	type: string;
	from: RouteTarget;
	to: RouteTarget;
	willUnload: boolean;
	shallow: boolean;
};

const ROUTE_DEPTH: Record<string, number> = {
	'/[lang=lang]': 0,
	'/[lang=lang]/regions/[regionKey]': 0,
	'/[lang=lang]/dishes/[dishKey]': 1,
	'/[lang=lang]/dishes/[dishKey]/[regionKey]': 2
};

function depthOf(target: RouteTarget): number | undefined {
	const id = target?.route.id;
	return id ? ROUTE_DEPTH[id] : undefined;
}

// The initial load, leaving the app, a full reload and shallow routing
// change no rendered page into another.
function isPageToPage(navigation: PageNavigation): boolean {
	if (navigation.type === 'enter' || navigation.type === 'leave') return false;
	return !navigation.willUnload && !navigation.shallow;
}

// Depth alone decides, so back/forward buttons move like links. A locale or
// query change keeps the depth and so has no transition.
export function pageDirection(navigation: PageNavigation): PageDirection {
	if (!isPageToPage(navigation)) return 'none';
	const from = depthOf(navigation.from);
	const to = depthOf(navigation.to);
	if (from === undefined || to === undefined || from === to) return 'none';
	return to > from ? 'push' : 'pop';
}
