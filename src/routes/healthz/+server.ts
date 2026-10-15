import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Liveness only: no backend dependency. Readiness (/readyz) arrives in FE-2.
export const GET: RequestHandler = () =>
	json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
