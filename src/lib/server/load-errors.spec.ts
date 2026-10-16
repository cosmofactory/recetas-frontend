import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { ErrorClass } from '../../testutil/catalog';
import { loadExport } from '../../testutil/load-export';

// FE-2: loaders wrap data calls in orHttpError. An unknown key becomes a 404
// and an unreachable backend a 503 (the +error page localises both); the body
// never carries the underlying error's detail. Anything else is a bug and is
// rethrown untouched.

type OrHttpError = <T>(p: Promise<T>) => Promise<T>;

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
