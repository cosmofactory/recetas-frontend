import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /healthz', () => {
	it('returns 200 {"status":"ok"} and is never cached', async () => {
		const res = await GET({} as Parameters<typeof GET>[0]);
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toEqual({ status: 'ok' });
	});
});
