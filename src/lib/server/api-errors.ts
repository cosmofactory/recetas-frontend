// What a catalog source rejects with when the data can't be served. Loaders
// turn them into HTTP errors (load-errors.ts); the message is for logs only.

// No such region, dish or variation (API 404).
export class NotFoundError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'NotFoundError';
	}
}

// The backend is unreachable, timed out or answered 5xx.
export class UnavailableError extends Error {
	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'UnavailableError';
	}
}
