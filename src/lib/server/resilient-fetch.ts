// The fetch the API client uses: every attempt has its own timeout, and a
// network error (backend unreachable, connection reset) is retried once. A
// timeout is not retried, since the request already waited its full budget.
// Only used for idempotent GETs.

type Fetch = (request: Request) => Promise<Response>;

function isTimeout(err: unknown): boolean {
	return err instanceof DOMException && err.name === 'TimeoutError';
}

export function resilientFetch(fetch: typeof globalThis.fetch, timeoutMs: number): Fetch {
	// The signal goes in `init`, never into a wrapping `new Request(...)`:
	// undici follows a Request's outer signal only through a WeakRef, so a
	// timeout nothing else holds could be collected and never fire
	// (timeout-under-gc.spec.ts).
	const attempt = (request: Request) => fetch(request, { signal: AbortSignal.timeout(timeoutMs) });
	return async (request) => {
		try {
			return await attempt(request);
		} catch (err) {
			if (isTimeout(err)) throw err;
			return attempt(request);
		}
	};
}
