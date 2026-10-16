import { isHttpError } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorClass } from '../../testutil/catalog';
import { captureLogLines } from '../../testutil/log-capture';
import { loadExport } from '../../testutil/load-export';

// FE-2: loaders wrap data calls in orHttpError. An unknown key becomes a 404
// and an unreachable backend a 503 (the +error page localises both); the body
// never carries the underlying error's detail. Anything else is a bug and is
// rethrown untouched.

// The second argument is the loader's event: its `locals` object is the same
// for every loader of one request, so it keys "already logged this outage".
type RequestKey = { locals: Record<string, unknown> };
type OrHttpError = <T>(p: Promise<T>, event?: RequestKey) => Promise<T>;

const DETAIL = 'connect ECONNREFUSED 10.1.2.3:8080';

const errorClass = (name: string) => loadExport<ErrorClass>('src/lib/server/api-errors.ts', name);
const load = () => loadExport<OrHttpError>('src/lib/server/load-errors.ts', 'orHttpError');

async function caught(p: Promise<unknown>): Promise<unknown> {
	try {
		await p;
	} catch (err) {
		return err;
	}
	throw new Error('got a resolved promise, want a rejection');
}

describe('api errors', () => {
	for (const name of ['NotFoundError', 'UnavailableError']) {
		it(`${name} is an Error with its own name`, async () => {
			const Cls = await errorClass(name);
			const err = new Cls('detail');
			expect(err).toBeInstanceOf(Error);
			expect(err.name).toBe(name);
		});
	}

	it('NotFoundError and UnavailableError are distinct', async () => {
		const NotFoundError = await errorClass('NotFoundError');
		const UnavailableError = await errorClass('UnavailableError');
		expect(new NotFoundError()).not.toBeInstanceOf(UnavailableError);
		expect(new UnavailableError()).not.toBeInstanceOf(NotFoundError);
	});
});

describe('orHttpError', () => {
	// The 503 case logs; keep that line out of the test output.
	beforeEach(() => {
		captureLogLines();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('passes a resolved value through', async () => {
		const orHttpError = await load();
		await expect(orHttpError(Promise.resolve({ key: 'gal' }))).resolves.toEqual({ key: 'gal' });
	});

	const mapped = [
		{ name: 'NotFoundError', status: 404 },
		{ name: 'UnavailableError', status: 503 }
	];
	for (const { name, status } of mapped) {
		it(`maps ${name} to SvelteKit error(${status}) without the detail`, async () => {
			const [orHttpError, Cls] = await Promise.all([load(), errorClass(name)]);
			const err = await caught(orHttpError(Promise.reject(new Cls(DETAIL))));
			expect(isHttpError(err, status), `got ${String(err)}, want an HttpError ${status}`).toBe(
				true
			);
			expect(JSON.stringify((err as { body: unknown }).body)).not.toContain('ECONNREFUSED');
		});
	}

	it('rethrows any other error untouched', async () => {
		const orHttpError = await load();
		const bug = new TypeError('cannot read properties of undefined');
		const err = await caught(orHttpError(Promise.reject(bug)));
		expect(err).toBe(bug);
	});
});

// FE-2 observability: a 503 is logged once, through the structured logger
// (#lib/server/log.ts), with the underlying detail the response hides. The
// [lang=lang] layout and the page loader both hit the backend for one
// request; when it is down both fail, but the outage is one log line.
describe('orHttpError logging', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const outage = async () => {
		const Unavailable = await errorClass('UnavailableError');
		const network = new TypeError('fetch failed', { cause: new Error(DETAIL) });
		return new Unavailable('backend unreachable', { cause: network });
	};
	const fail = async (orHttpError: OrHttpError, event: RequestKey) =>
		caught(orHttpError(Promise.reject(await outage()), event));

	it('logs a 503 as one ERROR line carrying the error detail', async () => {
		const orHttpError = await load();
		const out = captureLogLines();
		await fail(orHttpError, { locals: {} });
		const lines = out.lines();
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ level: 'ERROR' });
		expect(out.raw(), `got ${out.raw()}, want the detail`).toContain('ECONNREFUSED');
	});

	it('logs one line when the layout and the page loader of one request both get a 503', async () => {
		const orHttpError = await load();
		const out = captureLogLines();
		const request = { locals: {} };
		await fail(orHttpError, request);
		await fail(orHttpError, request);
		expect(out.lines()).toHaveLength(1);
	});

	it('logs each request’s outage separately', async () => {
		const orHttpError = await load();
		const out = captureLogLines();
		await fail(orHttpError, { locals: {} });
		await fail(orHttpError, { locals: {} });
		expect(out.lines()).toHaveLength(2);
	});

	it('does not log a 404', async () => {
		const [orHttpError, NotFound] = await Promise.all([load(), errorClass('NotFoundError')]);
		const out = captureLogLines();
		await caught(orHttpError(Promise.reject(new NotFound(DETAIL)), { locals: {} }));
		expect(out.raw()).toBe('');
	});
});
