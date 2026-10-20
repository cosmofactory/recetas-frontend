import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bundle from '#lib/server/mock/content.bundle.json';
import { galicia, galiciaDetail, type CatalogSource, type Region } from '../../testutil/catalog';
import { createFakeFetch, respondJson, type FetchHandler } from '../../testutil/fake-fetch';
import { loadExport, repoFile } from '../../testutil/load-export';
import { captureLogLines, type LogLine } from '../../testutil/log-capture';

// FE-4 PR 1 review: a region's tileColor ends up in the map cells' style
// attribute, so it is validated once, at the server boundary, where API (and
// mock bundle) regions are mapped (stage FE-4 Small decisions, map bullet).
// Only `#RRGGBB` (^#[0-9A-Fa-f]{6}$) passes. Anything else keeps the
// region and all its other data but sets `tileColor: null` (decision: null,
// not omitted, so the field's presence never varies), and writes one
// log.error line naming the region key, like the bad media prefix. RegionMap
// draws a null colour as --placeholder.
//
// Contract: src/lib/server/region-colour.ts exports
// withValidTileColor(region) -> the region with its tileColor or null; both
// sources (api-source.ts for /v1/regions and /v1/regions/{key}, and
// mock/bundle-mapping.ts) use it.

type Coloured = { key: string; tileColor: string | null };
type WithValidTileColor = <R extends Coloured>(region: R) => R;
type CreateApiSource = (options: {
	baseUrl: string;
	fetch: typeof globalThis.fetch;
	timeoutMs: number;
}) => CatalogSource;
type CreateMockSource = (input: typeof bundle) => CatalogSource;

const MODULE = 'src/lib/server/region-colour.ts';
const INJECTED = 'red; background-image: url(https://evil.example/x)';
const COLOUR_MESSAGE = /tile ?colou?r/i;

const loadValidator = () => loadExport<WithValidTileColor>(MODULE, 'withValidTileColor');

afterEach(() => vi.restoreAllMocks());

function errorLinesAbout(lines: LogLine[], key: string): LogLine[] {
	return lines.filter(
		(line) =>
			line.level === 'ERROR' &&
			COLOUR_MESSAGE.test(String(line.msg)) &&
			JSON.stringify(line).includes(`"${key}"`)
	);
}

describe('withValidTileColor', () => {
	const valid = ['#9A9A5E', '#c4552e', '#000000', '#FfFfFf'];
	for (const tileColor of valid) {
		it(`keeps ${tileColor} and logs nothing`, async () => {
			const withValidTileColor = await loadValidator();
			const log = captureLogLines();
			const got = withValidTileColor({ ...galicia, tileColor });
			expect(got).toEqual({ ...galicia, tileColor });
			expect(log.lines(), 'got a log line for a valid colour').toEqual([]);
		});
	}

	const invalid = [
		INJECTED,
		'#9A9A5E;color:red',
		'#9A9A5E ',
		' #9A9A5E',
		'#9A9A5E\n',
		'9A9A5E',
		'#abc',
		'#9A9A5E00',
		'#GGGGGG',
		'red',
		'var(--region-olive)',
		'rgb(1, 2, 3)',
		''
	];
	for (const tileColor of invalid) {
		it(`nulls ${JSON.stringify(tileColor)}, keeps the rest, logs one error`, async () => {
			const withValidTileColor = await loadValidator();
			const log = captureLogLines();
			const input = { ...galicia, tileColor };
			const got = withValidTileColor(input);
			expect(got).toEqual({ ...galicia, tileColor: null });
			expect(input.tileColor, 'got the input mutated').toBe(tileColor);
			expect(errorLinesAbout(log.lines(), 'gal'), 'want one error naming gal').toHaveLength(1);
		});
	}
});

async function apiSourceAnswering(body: unknown): Promise<CatalogSource> {
	const create = await loadExport<CreateApiSource>(
		'src/lib/server/api-source.ts',
		'createApiSource'
	);
	const handler: FetchHandler = respondJson(200, body);
	const fake = createFakeFetch(handler);
	return create({ baseUrl: 'http://backend:8080', fetch: fake.fetch, timeoutMs: 1000 });
}

const asturias: Region = {
	...galicia,
	key: 'ast',
	order: 2,
	name: 'Asturias',
	mapLabel: 'Asturias'
};

describe('the API source validates tileColor', () => {
	it('nulls a bad colour in /v1/regions, keeps the other regions as sent, logs once', async () => {
		const log = captureLogLines();
		const source = await apiSourceAnswering([{ ...galicia, tileColor: INJECTED }, asturias]);
		const got = await source.listRegions('en');
		await source.listRegions('en');
		expect(got).toEqual([{ ...galicia, tileColor: null }, asturias]);
		expect(errorLinesAbout(log.lines(), 'gal'), 'want one error per fetched list').toHaveLength(1);
	});

	it('nulls a bad colour in /v1/regions/{key}', async () => {
		const log = captureLogLines();
		const source = await apiSourceAnswering({ ...galiciaDetail, tileColor: INJECTED });
		const got = await source.getRegion('en', 'gal');
		expect(got).toEqual({ ...galiciaDetail, tileColor: null });
		expect(errorLinesAbout(log.lines(), 'gal')).toHaveLength(1);
	});
});

function bundleWithGaliciaColour(tileColor: string): typeof bundle {
	const regions = bundle.regions.map((r) => (r.key === 'gal' ? { ...r, tileColor } : r));
	return { ...bundle, regions };
}

describe('the mock source validates tileColor', () => {
	it('nulls a bad colour in the region list and the region detail, and logs it', async () => {
		const create = await loadExport<CreateMockSource>(
			'src/lib/server/mock/mock-source.ts',
			'createMockSource'
		);
		const log = captureLogLines();
		const source = create(bundleWithGaliciaColour(INJECTED));
		const list = await source.listRegions('en');
		expect(list.find((r) => r.key === 'gal')?.tileColor).toBeNull();
		expect(list.find((r) => r.key === 'ast')?.tileColor).toBe('#C97B4A');
		expect((await source.getRegion('ru', 'gal')).tileColor).toBeNull();
		expect(errorLinesAbout(log.lines(), 'gal').length, 'want it logged').toBeGreaterThan(0);
	});

	it('logs nothing for the vendored bundle (all colours are #RRGGBB)', async () => {
		const create = await loadExport<CreateMockSource>(
			'src/lib/server/mock/mock-source.ts',
			'createMockSource'
		);
		const log = captureLogLines();
		await create(bundle).listRegions('en');
		expect(log.lines()).toEqual([]);
	});
});

describe('one validation rule for both sources', () => {
	const users = ['src/lib/server/api-source.ts', 'src/lib/server/mock/bundle-mapping.ts'];
	for (const file of users) {
		it(`${file} uses region-colour.ts`, () => {
			const source = readFileSync(repoFile(file), 'utf8');
			expect(source, `got no region-colour.ts import in ${file}`).toMatch(
				/from '[^']*region-colour\.ts'/
			);
		});
	}
});
