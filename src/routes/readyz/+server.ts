import { BACKEND_API_BASE_URL } from '$app/env/private';
import { OK, SERVICE_UNAVAILABLE } from '#lib/http-status.ts';
import { checkBackendReady } from '#lib/server/readiness.ts';
import type { RequestHandler } from './$types';

const BACKEND_TIMEOUT_MS = 2_000;

// Readiness for INF-2 smoke tests and INF-3 uptime checks: the API is not
// public (stack.md X4), so this asks it on their behalf. No error detail in
// the body. Without a configured backend it is not ready. Deliberately not
// event.fetch (see readiness.ts).
export const GET: RequestHandler = async () => {
	const ready =
		BACKEND_API_BASE_URL !== undefined &&
		(await checkBackendReady({ baseUrl: BACKEND_API_BASE_URL, timeoutMs: BACKEND_TIMEOUT_MS }));
	return new Response(null, {
		status: ready ? OK : SERVICE_UNAVAILABLE,
		headers: { 'cache-control': 'no-store' }
	});
};
