// A hand-written fetch double for the server data layer (FE-2). It records
// every request and lets each test decide how the "backend" answers.

export type RecordedRequest = { url: URL; method: string; headers: Headers };
// `signal` is the caller's own abort signal, not the one of a re-wrapped
// Request: undici's Request only follows an outer signal through a WeakRef,
// so a copy can miss the abort once the original is garbage-collected.
export type FetchHandler = (
	request: Request,
	signal: AbortSignal | undefined
) => Response | Promise<Response>;

export function createFakeFetch(handler: FetchHandler) {
	const calls: RecordedRequest[] = [];
	const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const request = new Request(input, init);
		calls.push({ url: new URL(request.url), method: request.method, headers: request.headers });
		return handler(request, callerSignal(input, init));
	};
	return { fetch: fetch as typeof globalThis.fetch, calls };
}

function callerSignal(input: RequestInfo | URL, init?: RequestInit): AbortSignal | undefined {
	return init?.signal ?? (input instanceof Request ? input.signal : undefined);
}

// Answers the n-th call with handlers[n]; later calls reuse the last handler.
export function inOrder(...handlers: FetchHandler[]): FetchHandler {
	let next = 0;
	return (request, signal) => handlers[Math.min(next++, handlers.length - 1)](request, signal);
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});
}

export function respondJson(status: number, body: unknown, headers?: Record<string, string>) {
	return () => jsonResponse(status, body, headers);
}

// The API's error body (openapi.yaml components.schemas.Error).
export function respondApiError(status: number, code: string): FetchHandler {
	return respondJson(status, { error: { code, message: 'safe message' } });
}

export function respondNotModified(etag: string): FetchHandler {
	return () => new Response(null, { status: 304, headers: { etag } });
}

// What undici does when the backend is unreachable.
export function failNetwork(detail = 'connect ECONNREFUSED 10.1.2.3:8080'): FetchHandler {
	return () => Promise.reject(new TypeError('fetch failed', { cause: new Error(detail) }));
}

// Never answers; rejects with the abort reason once the caller's signal
// aborts, as a real fetch does on timeout. Without a signal it hangs forever.
export function hangUntilAborted(_request: Request, signal?: AbortSignal): Promise<Response> {
	return new Promise((_, reject) => {
		if (!signal) return;
		if (signal.aborted) reject(signal.reason);
		signal.addEventListener('abort', () => reject(signal.reason), { once: true });
	});
}
