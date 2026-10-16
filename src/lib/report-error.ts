// Where shared (server and browser) code reports an error. It can't import
// the structured logger, which lives in $lib/server, so hooks.server.ts plugs
// it in at startup. Until then, and in unit tests, reports go to console.error.

export type ErrorReporter = (msg: string, err: unknown) => void;

const consoleReporter: ErrorReporter = (msg, err) => console.error(`${msg}:`, err);

let reporter = consoleReporter;

export function setErrorReporter(next: ErrorReporter): void {
	reporter = next;
}

export function reportError(msg: string, err: unknown): void {
	reporter(msg, err);
}
