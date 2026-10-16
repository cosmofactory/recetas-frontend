import { describe, expect, it, vi } from 'vitest';
import type { Lang } from '../../testutil/catalog';
import { loadExport } from '../../testutil/load-export';

// FE-2 catalog cache (X1): per-locale, in-memory cache of the /v1/regions and
// /v1/dishes lists. Fresh for ttlMs, then revalidated with the stored ETag;
// concurrent misses are coalesced into one request; failures are never
// cached and never hidden behind a stale body.

type Body = string[];
type ListFetchResult<T> = { status: 200; body: T; etag?: string } | { status: 304 };
type FetchList<T> = (lang: Lang, etag?: string) => Promise<ListFetchResult<T>>;
type ListCache<T> = { get(lang: Lang): Promise<T> };
type CreateListCache = <T>(options: {
	fetchList: FetchList<T>;
	ttlMs: number;
	now: () => number;
}) => ListCache<T>;

const TTL_MS = 1_000;
const ETAG_V1 = 'W/"1-en"';
const ETAG_V2 = 'W/"2-en"';
const BODY_V1: Body = ['gal', 'ast'];
const BODY_V2: Body = ['gal', 'ast', 'bas'];
const NOT_MODIFIED: ListFetchResult<Body> = { status: 304 };

const ok = (body: Body, etag?: string): ListFetchResult<Body> => ({ status: 200, body, etag });

async function setup() {
	const create = await loadExport<CreateListCache>(
		'src/lib/server/catalog-cache.ts',
		'createListCache'
	);
	let clock = 0;
	const fetchList = vi.fn<FetchList<Body>>();
	const cache = create<Body>({ fetchList, ttlMs: TTL_MS, now: () => clock });
	const advance = (ms: number) => (clock += ms);
	return { cache, fetchList, advance };
}

// A cache that already holds BODY_V1 / ETAG_V1 for en, fetched at t=0.
async function warmSetup() {
	const s = await setup();
	s.fetchList.mockResolvedValueOnce(ok(BODY_V1, ETAG_V1));
	await s.cache.get('en');
	return s;
}

function expectCalls(fetchList: ReturnType<typeof vi.fn>, want: number) {
	const got = fetchList.mock.calls.length;
	expect(got, `got ${got} fetchList calls, want ${want}`).toBe(want);
}

describe('createListCache', () => {
	it('fetches on a miss, without an ETag', async () => {
		const { cache, fetchList } = await setup();
		fetchList.mockResolvedValueOnce(ok(BODY_V1, ETAG_V1));
		await expect(cache.get('en')).resolves.toEqual(BODY_V1);
		expect(fetchList).toHaveBeenCalledExactlyOnceWith('en', undefined);
	});

	it('serves a hit within the TTL without fetching', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS - 1);
		await expect(cache.get('en')).resolves.toEqual(BODY_V1);
		expectCalls(fetchList, 1);
	});

	it('revalidates with the stored ETag after the TTL and keeps the body on 304', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS + 1);
		fetchList.mockResolvedValueOnce(NOT_MODIFIED);
		await expect(cache.get('en')).resolves.toEqual(BODY_V1);
		expect(fetchList).toHaveBeenLastCalledWith('en', ETAG_V1);
	});

	it('resets the TTL on a 304', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS + 1);
		fetchList.mockResolvedValueOnce(NOT_MODIFIED);
		await cache.get('en');
		advance(TTL_MS - 1);
		await expect(cache.get('en')).resolves.toEqual(BODY_V1);
		expectCalls(fetchList, 2);
	});

	it('replaces the body and ETag when revalidation returns 200', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS + 1);
		fetchList.mockResolvedValueOnce(ok(BODY_V2, ETAG_V2));
		await expect(cache.get('en')).resolves.toEqual(BODY_V2);
		advance(TTL_MS + 1);
		fetchList.mockResolvedValueOnce(NOT_MODIFIED);
		await expect(cache.get('en')).resolves.toEqual(BODY_V2);
		expect(fetchList).toHaveBeenLastCalledWith('en', ETAG_V2);
	});

	it('refetches without an ETag when the first response had none', async () => {
		const { cache, fetchList, advance } = await setup();
		fetchList.mockResolvedValueOnce(ok(BODY_V1));
		await cache.get('en');
		advance(TTL_MS + 1);
		fetchList.mockResolvedValueOnce(ok(BODY_V2));
		await expect(cache.get('en')).resolves.toEqual(BODY_V2);
		expect(fetchList).toHaveBeenLastCalledWith('en', undefined);
	});

	it('caches each locale separately', async () => {
		const { cache, fetchList } = await setup();
		fetchList.mockImplementation(async (lang) => ok([lang], `W/"1-${lang}"`));
		await expect(cache.get('en')).resolves.toEqual(['en']);
		await expect(cache.get('ru')).resolves.toEqual(['ru']);
		await expect(cache.get('en')).resolves.toEqual(['en']);
		expect(fetchList.mock.calls.map(([lang]) => lang)).toEqual(['en', 'ru']);
	});
});

describe('createListCache request coalescing', () => {
	const CONCURRENT = 5;

	it(`turns ${CONCURRENT} concurrent misses for one locale into one fetch`, async () => {
		const { cache, fetchList } = await setup();
		const pending = Promise.withResolvers<ListFetchResult<Body>>();
		fetchList.mockReturnValueOnce(pending.promise);
		const gets = Array.from({ length: CONCURRENT }, () => cache.get('en'));
		pending.resolve(ok(BODY_V1, ETAG_V1));
		const bodies = await Promise.all(gets);
		expectCalls(fetchList, 1);
		expect(bodies).toEqual(Array(CONCURRENT).fill(BODY_V1));
	});

	it('does not merge concurrent misses for different locales', async () => {
		const { cache, fetchList } = await setup();
		fetchList.mockImplementation(async (lang) => ok([lang]));
		const bodies = await Promise.all([cache.get('en'), cache.get('ru'), cache.get('en')]);
		expect(bodies).toEqual([['en'], ['ru'], ['en']]);
		expectCalls(fetchList, 2);
	});

	it('turns concurrent gets of a stale entry into one revalidation', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS + 1);
		const pending = Promise.withResolvers<ListFetchResult<Body>>();
		fetchList.mockReturnValueOnce(pending.promise);
		const gets = Array.from({ length: CONCURRENT }, () => cache.get('en'));
		pending.resolve(NOT_MODIFIED);
		await Promise.all(gets);
		expectCalls(fetchList, 2);
	});
});

describe('createListCache failures', () => {
	it('does not cache a failed fetch: the error passes through and a later get retries', async () => {
		const { cache, fetchList } = await setup();
		const failure = new Error('backend down');
		fetchList.mockRejectedValueOnce(failure).mockResolvedValueOnce(ok(BODY_V1, ETAG_V1));
		await expect(cache.get('en')).rejects.toBe(failure);
		await expect(cache.get('en')).resolves.toEqual(BODY_V1);
		expectCalls(fetchList, 2);
	});

	it('rejects every coalesced waiter of a failed fetch', async () => {
		const { cache, fetchList } = await setup();
		const failure = new Error('backend down');
		fetchList.mockRejectedValueOnce(failure);
		const results = await Promise.allSettled([cache.get('en'), cache.get('en')]);
		expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
		expectCalls(fetchList, 1);
	});

	it('rejects when revalidation fails even though a stale body exists (no stale-serving)', async () => {
		const { cache, fetchList, advance } = await warmSetup();
		advance(TTL_MS + 1);
		const failure = new Error('backend down');
		fetchList.mockRejectedValueOnce(failure);
		await expect(cache.get('en')).rejects.toBe(failure);
	});
});
