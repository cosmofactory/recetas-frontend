import { error } from '@sveltejs/kit';
import { NOT_FOUND, SERVICE_UNAVAILABLE } from '#lib/http-status.ts';
import { NotFoundError, UnavailableError } from './api-errors.ts';

// Wraps a loader's data call: an unknown key is a 404 and an unavailable
// backend a 503; +error.svelte localises both. The detail stays out of the
// response. Any other error is a bug and propagates as-is (a 500).
export async function orHttpError<T>(pending: Promise<T>): Promise<T> {
	try {
		return await pending;
	} catch (err) {
		if (err instanceof NotFoundError) error(NOT_FOUND);
		if (err instanceof UnavailableError) {
			console.error('catalog unavailable:', err);
			error(SERVICE_UNAVAILABLE);
		}
		throw err;
	}
}
