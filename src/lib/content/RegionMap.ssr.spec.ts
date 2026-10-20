import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import bundle from '#lib/server/mock/content.bundle.json';
import { createMockSource } from '#lib/server/mock/mock-source.ts';
import { loadExport } from '../../testutil/load-export';
import { captureLogLines } from '../../testutil/log-capture';
import { regionHref, regionsIn, type MapRegion } from '../../testutil/map';

// FE-4 RegionMap, server side. Stage FE-4: "the server renders deep links",
// and the acceptance checks /ru/regions/gal "with JavaScript disabled: the
// content is present in the HTML". So each region is a real link to
// /:lang/regions/:key in the server HTML (not a button that needs JS). The
// map is itself the screen-reader region list (FE-4 PR 1 review: no
// separate hidden list), so every region URL appears exactly once.
//
// tileColor reaches the cells' style attribute, so it is validated at the
// server boundary (the catalog mapping, #RRGGBB only; a bad value becomes
// null and is logged): a crafted value such as
// `red; background-image: url(https://evil.example/x)` must never reach the
// HTML.

type RegionMapProps = {
	regions: MapRegion[];
	selectedKey?: string;
	hrefFor: (key: string) => string;
};

const loadRegionMap = () =>
	loadExport<Component<RegionMapProps>>('src/lib/content/RegionMap.svelte', 'default');

async function serverHtml(props: Partial<RegionMapProps> = {}): Promise<string> {
	const RegionMap = await loadRegionMap();
	const regions = props.regions ?? regionsIn('ru');
	const { body } = render(RegionMap, { props: { regions, hrefFor: regionHref('ru'), ...props } });
	return body;
}

function occurrences(html: string, text: string): number {
	return html.split(text).length - 1;
}

describe('RegionMap server render', () => {
	it('links every region exactly once to /:lang/regions/:key', async () => {
		const html = await serverHtml();
		for (const region of regionsIn('ru')) {
			const href = `href="${regionHref('ru')(region.key)}"`;
			const got = occurrences(html, href);
			expect(got, `got ${got} links to ${region.key}, want 1`).toBe(1);
		}
	});

	it('renders the map as one list of 14 items', async () => {
		const html = await serverHtml();
		expect(occurrences(html, '<ul'), 'want exactly one list').toBe(1);
		const list = html.match(/<ul\b[^>]*>/)?.[0] ?? '';
		expect(list, `got ${list}, want the map box itself`).toContain('data-testid="region-map"');
		expect(occurrences(html, '<li'), 'want one item per region').toBe(14);
	});

	it('renders no buttons: selection works without JavaScript', async () => {
		expect(await serverHtml()).not.toMatch(/<button\b/);
	});

	it('includes the Russian region names and map labels', async () => {
		const html = await serverHtml();
		for (const region of regionsIn('ru')) {
			expect(html, `got no name ${region.name}`).toContain(region.name);
			expect(html, `got no map label ${region.mapLabel}`).toContain(region.mapLabel);
		}
	});

	it('marks only the selected region (deep link /ru/regions/gal) as current', async () => {
		const html = await serverHtml({ selectedKey: 'gal' });
		for (const region of regionsIn('ru')) {
			const current = linkTags(html, region.key).some((tag) => CURRENT.test(tag));
			const want = region.key === 'gal';
			expect(current, `got aria-current ${current} on ${region.key}, want ${want}`).toBe(want);
		}
	});
});

const CURRENT = /aria-current="(?!false")/;

function linkTags(html: string, key: string): string[] {
	const href = regionHref('ru')(key);
	return html.match(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`, 'g')) ?? [];
}

describe('RegionMap server render without a selection', () => {
	it('marks no region as current', async () => {
		const html = await serverHtml();
		expect(html, 'got aria-current with nothing selected').not.toMatch(CURRENT);
	});
});

const INJECTED = 'red; background-image: url(https://evil.example/x)';

function bundleWithGaliciaColour(tileColor: string): typeof bundle {
	const regions = bundle.regions.map((r) => (r.key === 'gal' ? { ...r, tileColor } : r));
	return { ...bundle, regions };
}

describe('RegionMap server render with a crafted tileColor from the catalog', () => {
	afterEach(() => vi.restoreAllMocks());

	it('never puts the value in the HTML (validated at the server boundary)', async () => {
		captureLogLines();
		const regions = await createMockSource(bundleWithGaliciaColour(INJECTED)).listRegions('en');
		const html = await serverHtml({ regions: regions as MapRegion[], hrefFor: regionHref('en') });
		expect(html, 'got the injected URL in the HTML').not.toContain('evil.example');
		expect(html, 'got the injected url() in the HTML').not.toContain('url(');
		expect(html, 'want Galicia still drawn').toContain(`href="${regionHref('en')('gal')}"`);
	});
});
