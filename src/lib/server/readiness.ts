// Readiness (/readyz): the backend is ready when its /healthz answers 200
// within the timeout. Every other outcome is "not ready"; this never throws.
// It uses the global fetch unless one is injected: SvelteKit's event.fetch
// re-wraps the request, which can lose the timeout signal under GC
// (timeout-under-gc.spec.ts).

const HEALTH_PATH = '/healthz';

type ReadinessOptions = { baseUrl: string; timeoutMs: number; fetch?: typeof globalThis.fetch };

export async function checkBackendReady({
	baseUrl,
	timeoutMs,
	fetch = globalThis.fetch
}: ReadinessOptions): Promise<boolean> {
	try {
		const url = new URL(HEALTH_PATH, baseUrl);
		const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		await response.body?.cancel();
		return response.ok;
	} catch {
		return false;
	}
}
