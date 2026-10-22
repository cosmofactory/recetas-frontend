import type { Component } from 'svelte';
import { vi } from 'vitest';
import { loadExport } from './load-export';
import type { Lang } from './map';

// Renders a route's +page.svelte with svelte/server inside the request
// locale, with $app/state and $app/navigation mocked for that URL. Call
// `unmockKit` in afterEach.

export type KitPageSpec<Data> = {
	pageFile: string;
	routeId: string;
	lang: Lang;
	url: string;
	params: Record<string, string>;
	data: Data;
};

const ORIGIN = 'http://localhost';

function mockKit(spec: KitPageSpec<unknown>) {
	const url = new URL(spec.url, ORIGIN);
	const { params, data } = spec;
	vi.doMock('$app/state', () => ({
		page: { params, route: { id: spec.routeId }, url, data, status: 200, error: null, state: {} },
		navigating: null
	}));
	vi.doMock('$app/navigation', () => ({
		goto: vi.fn(),
		onNavigate: vi.fn(),
		afterNavigate: vi.fn(),
		beforeNavigate: vi.fn(),
		pushState: vi.fn(),
		replaceState: vi.fn()
	}));
}

export function unmockKit() {
	vi.doUnmock('$app/state');
	vi.doUnmock('$app/navigation');
}

type PageProps<Data> = { data: Data; params: Record<string, string> };

export async function renderKitPage<Data>(
	spec: KitPageSpec<Data>
): Promise<{ head: string; body: string }> {
	vi.resetModules();
	mockKit(spec);
	const Page = await loadExport<Component<PageProps<Data>>>(spec.pageFile, 'default');
	// After resetModules, so the page, the renderer and the locale store share
	// one Svelte runtime and one Paraglide runtime.
	const { render } = await import('svelte/server');
	const { withRequestLocale } = await import('#lib/server/request-locale.ts');
	return withRequestLocale(spec.lang, () => {
		const { head, body } = render(Page, { props: { data: spec.data, params: spec.params } });
		return { head, body };
	});
}
