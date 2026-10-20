// Fake SvelteKit navigations for the FE-3 PagePush specs: the shape
// onNavigate passes ($app/navigation NavigationBase), built from plain URL
// paths so a case table reads like the routes it moves between.

export type NavigationType = 'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate';

export type FakeTarget = {
	params: Record<string, string> | null;
	route: { id: string | null };
	url: URL;
	scroll: null;
};

export type FakeNavigation = {
	type: NavigationType;
	from: FakeTarget | null;
	to: FakeTarget | null;
	delta?: number;
	willUnload: boolean;
	shallow: boolean;
	complete: Promise<void>;
};

const ORIGIN = 'http://localhost';

type Matched = { id: string | null; params: Record<string, string> };

// The app's routes (src/routes/[lang=lang]/...), matched by segment shape.
function matchRoute(lang: string, rest: string[]): Matched {
	const [section, first, second, ...extra] = rest;
	if (extra.length > 0) return { id: null, params: {} };
	if (section === undefined) return { id: '/[lang=lang]', params: { lang } };
	if (section === 'regions' && first && !second)
		return { id: '/[lang=lang]/regions/[regionKey]', params: { lang, regionKey: first } };
	if (section === 'dishes' && first && !second)
		return { id: '/[lang=lang]/dishes/[dishKey]', params: { lang, dishKey: first } };
	if (section === 'dishes' && first && second)
		return {
			id: '/[lang=lang]/dishes/[dishKey]/[regionKey]',
			params: { lang, dishKey: first, regionKey: second }
		};
	if (section === '_dev' && first === 'ui' && !second)
		return { id: '/[lang=lang]/_dev/ui', params: { lang } };
	return { id: null, params: {} };
}

// The target for a path such as "/en/dishes/tortilla/gal?x=1". An unknown
// path is a 404: route id null, as SvelteKit reports it.
export function target(path: string): FakeTarget {
	const url = new URL(path, ORIGIN);
	const [lang, ...rest] = url.pathname.split('/').filter(Boolean);
	const { id, params } = matchRoute(lang ?? '', rest);
	return { params: id === null ? null : params, route: { id }, url, scroll: null };
}

export type Deferred = { promise: Promise<void>; resolve: () => void };

export function deferred(): Deferred {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

export type NavigationSpec = {
	type?: NavigationType;
	from: string | null;
	to: string | null;
	delta?: number;
	willUnload?: boolean;
	shallow?: boolean;
	complete?: Promise<void>;
};

export function navigation(spec: NavigationSpec): FakeNavigation {
	return {
		type: spec.type ?? 'link',
		from: spec.from === null ? null : target(spec.from),
		to: spec.to === null ? null : target(spec.to),
		delta: spec.delta,
		willUnload: spec.willUnload ?? false,
		shallow: spec.shallow ?? false,
		complete: spec.complete ?? Promise.resolve()
	};
}
