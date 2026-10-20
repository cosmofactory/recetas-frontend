import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExport } from '../../../../testutil/load-export';

// FE-3: the /:lang/_dev/ui gallery shows the UI primitives side by side for
// checks against the prototypes. It exists only under `vite dev`: in any
// other build its load answers 404, so it is never served or indexed.

type Load = (event: { params: { lang: string } }) => unknown;
const PAGE = 'src/routes/[lang=lang]/_dev/ui/+page.server.ts';
const EVENT = { params: { lang: 'en' } };

// By shape: vi.resetModules gives the route a fresh @sveltejs/kit, so its
// HttpError is not the class this file would import.
function httpStatus(err: unknown): number | undefined {
	const e = err as { status?: unknown; body?: unknown } | undefined;
	return typeof e?.status === 'number' && e.body !== undefined ? e.status : undefined;
}

async function loadWithDev(dev: boolean): Promise<Load> {
	vi.resetModules();
	vi.doMock('$app/env', () => ({ dev, building: false, browser: false }));
	return loadExport<Load>(PAGE, 'load');
}

async function outcome(load: Load): Promise<unknown> {
	try {
		await load(EVENT);
	} catch (err) {
		return err;
	}
	return undefined;
}

afterEach(() => vi.doUnmock('$app/env'));

describe('_dev/ui gallery load', () => {
	it('throws a 404 outside vite dev', async () => {
		const err = await outcome(await loadWithDev(false));
		expect(httpStatus(err), `got ${String(err)}, want an HttpError 404`).toBe(404);
	});

	it('loads under vite dev', async () => {
		const err = await outcome(await loadWithDev(true));
		expect(err, `got ${String(err)}, want no error in dev`).toBeUndefined();
	});
});
