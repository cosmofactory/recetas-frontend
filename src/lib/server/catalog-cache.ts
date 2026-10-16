import type { Lang } from './catalog-source.ts';

// Per-locale, in-memory cache of a catalog list (stack.md X1). An entry is
// fresh for ttlMs, then revalidated with its ETag (If-None-Match). Concurrent
// misses share one request (request coalescing), so a cold cache doesn't fire
// N identical calls. Failures are never cached and a stale body is never
// served in their place: the caller gets the error.

export type ListFetchResult<T> = { status: 200; body: T; etag?: string } | { status: 304 };
export type FetchList<T> = (lang: Lang, etag?: string) => Promise<ListFetchResult<T>>;
export type ListCache<T> = { get(lang: Lang): Promise<T> };

type ListCacheOptions<T> = { fetchList: FetchList<T>; ttlMs: number; now: () => number };
type Entry<T> = { body: T; etag?: string; fetchedAt: number };

export function createListCache<T>({ fetchList, ttlMs, now }: ListCacheOptions<T>): ListCache<T> {
	const entries = new Map<Lang, Entry<T>>();
	const inFlight = new Map<Lang, Promise<T>>();

	async function refresh(lang: Lang): Promise<T> {
		const stale = entries.get(lang);
		const result = await fetchList(lang, stale?.etag);
		const entry = nextEntry(result, stale, now());
		entries.set(lang, entry);
		return entry.body;
	}

	function startRefresh(lang: Lang): Promise<T> {
		const pending = refresh(lang).finally(() => inFlight.delete(lang));
		inFlight.set(lang, pending);
		return pending;
	}

	return {
		get(lang) {
			const entry = entries.get(lang);
			if (entry && now() - entry.fetchedAt < ttlMs) return Promise.resolve(entry.body);
			return inFlight.get(lang) ?? startRefresh(lang);
		}
	};
}

function nextEntry<T>(result: ListFetchResult<T>, stale: Entry<T> | undefined, fetchedAt: number) {
	if (result.status === 200) return { body: result.body, etag: result.etag, fetchedAt };
	// Only possible if the backend ignores the validator semantics.
	if (!stale) throw new Error('got 304 Not Modified for a list that is not cached');
	return { ...stale, fetchedAt };
}
