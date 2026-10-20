import { error } from '@sveltejs/kit';
import { NOT_FOUND, SERVICE_UNAVAILABLE } from '#lib/http-status.ts';
import { NotFoundError, UnavailableError } from './api-errors.ts';
import { log } from './log.ts';

// What identifies one request across its loaders: Kit passes every loader of
// a request the same `locals` object.
type RequestKey = { locals: object };

// Requests whose outage is already logged. The layout and the page loader
// both hit the backend, so one outage would otherwise be two lines.
const loggedOutages = new WeakSet<object>();

// Wraps a loader's data call: an unknown key is a 404 and an unavailable
// backend a 503; +error.svelte localises both. The detail stays out of the
// response and goes to the log, once per request. Any other error is a bug
// and propagates as-is (a 500).
export async function orHttpError<T>(pending: Promise<T>, event?: RequestKey): Promise<T> {
	try {
		return await pending;
	} catch (err) {
		if (err instanceof NotFoundError) error(NOT_FOUND);
		if (err instanceof UnavailableError) {
			logOutageOnce(err, event);
			error(SERVICE_UNAVAILABLE);
		}
		throw err;
	}
}

function logOutageOnce(err: UnavailableError, event?: RequestKey): void {
	if (event && loggedOutages.has(event.locals)) return;
	if (event) loggedOutages.add(event.locals);
	log.error('catalog unavailable', { err });
}
