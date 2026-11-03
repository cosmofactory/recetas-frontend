import { describe, expect, it } from 'vitest';
import { repoFile } from '../../../testutil/load-export';

// The home's region selection (region-selection.ts). FE-9 FB-13, spec change
// D-FE9-8 (owner, 2026-11-03): desktop README -> Regional, "No region is
// selected on first load (was "Andalucía is selected on first load")"; stage
// FE-9 -> FB-13: "`DEFAULT_DESKTOP_REGION_KEY` goes". The selection is the
// URL's region on both layouts, or none; the screens pin the rest
// (layout.ssr.spec.ts, home-region.e2e.ts, home-map-dim.e2e.ts).

const MODULE = 'src/lib/components/home/region-selection.ts';

type Region = { key: string; name: string };
type FindRegion = (regions: readonly Region[], key: string | undefined) => Region | undefined;

const REGIONS: Region[] = [
	{ key: 'gal', name: 'Galicia' },
	{ key: 'and', name: 'Andalucía' }
];

async function regionSelection(): Promise<Record<string, unknown>> {
	return (await import(/* @vite-ignore */ repoFile(MODULE))) as Record<string, unknown>;
}

describe('region-selection: no desktop default region (D-FE9-8)', () => {
	it('exports no default region key', async () => {
		const exported = Object.keys(await regionSelection());
		const defaults = exported.filter((name) => /default/i.test(name));
		expect(defaults, `got ${JSON.stringify(defaults)}, want no default export`).toEqual([]);
	});
});

describe('findRegion: the region the URL names', () => {
	const cases: { what: string; key: string | undefined; want: Region | undefined }[] = [
		{ what: 'no key (the bare home) finds no region', key: undefined, want: undefined },
		{ what: 'a known key finds that region', key: 'gal', want: REGIONS[0] },
		{ what: 'an unknown key finds no region', key: 'xyz', want: undefined }
	];
	for (const { what, key, want } of cases) {
		it(what, async () => {
			const findRegion = (await regionSelection()).findRegion as FindRegion;
			const got = findRegion(REGIONS, key);
			expect(got, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).toEqual(want);
		});
	}
});
