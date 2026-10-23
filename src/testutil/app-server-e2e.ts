import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect } from '@playwright/test';
import { APP_ENV } from './e2e-app-env';
import { PUBLIC_ORIGIN } from './e2e-origin';

// A second production server (`node build`, the build the Playwright
// webServer made) with its own environment, for behaviour that depends on
// runtime env vars (MEDIA_BASE_URL in the CSP, DATA_SOURCE=api against a
// broken backend). It listens on a free port, so parallel workers never clash.

const HOST = '127.0.0.1';
// Below Playwright's default 30s hook timeout, so a server that never comes up
// fails with our error (and its stderr), not a bare beforeAll timeout.
const READY_TIMEOUT_MS = 20_000;
// Enough of the server's stderr to show why it failed to start.
const STDERR_TAIL_CHARS = 4_000;
const BUILD_DIR = 'build';

export type AppServer = { baseURL: string; stop: () => Promise<void> };

// The webServer's environment (playwright.config.ts), before overrides.
const BASE_ENV = { HOST, PUBLIC_ORIGIN, APP_ENV, DATA_SOURCE: 'mock' };

export async function freePort(): Promise<number> {
	const probe = createServer();
	await new Promise<void>((resolve) => probe.listen(0, HOST, resolve));
	const { port } = probe.address() as AddressInfo;
	await new Promise<void>((resolve) => probe.close(() => resolve()));
	return port;
}

async function healthStatus(baseURL: string): Promise<number> {
	try {
		return (await fetch(`${baseURL}/healthz`)).status;
	} catch {
		return 0;
	}
}

function stopped(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
	return new Promise((resolve) => {
		child.once('exit', () => resolve());
		child.kill();
	});
}

// The tail of the child's stderr; reading it also keeps the pipe drained.
function stderrTail(child: ChildProcess): () => string {
	let tail = '';
	child.stderr?.setEncoding('utf8');
	child.stderr?.on('data', (chunk: string) => {
		tail = (tail + chunk).slice(-STDERR_TAIL_CHARS);
	});
	return () => tail;
}

async function waitUntilHealthy(baseURL: string): Promise<void> {
	await expect
		.poll(() => healthStatus(baseURL), {
			message: `want node build on ${baseURL} healthy`,
			timeout: READY_TIMEOUT_MS
		})
		.toBe(200);
}

// `env` overrides the base environment; a value of undefined unsets it.
// A server that never gets healthy is killed, and the error carries its stderr.
export async function startAppServer(env: Record<string, string | undefined>): Promise<AppServer> {
	const port = await freePort();
	const merged = { ...process.env, ...BASE_ENV, PORT: String(port), ...env };
	const child = spawn(process.execPath, [BUILD_DIR], {
		env: merged,
		stdio: ['ignore', 'ignore', 'pipe']
	});
	const stderr = stderrTail(child);
	const baseURL = `http://${HOST}:${port}`;
	try {
		await waitUntilHealthy(baseURL);
	} catch (err) {
		await stopped(child);
		throw new Error(`node build on ${baseURL} never got healthy; stderr:\n${stderr()}`, {
			cause: err
		});
	}
	return { baseURL, stop: () => stopped(child) };
}

export type FakeBackend = { baseURL: string; stop: () => Promise<void> };

// A stand-in Go API answering every request with `handler`.
export async function startFakeBackend(handler: RequestListener): Promise<FakeBackend> {
	const server: Server = createServer(handler);
	await new Promise<void>((resolve) => server.listen(0, HOST, resolve));
	const { port } = server.address() as AddressInfo;
	const stop = () => new Promise<void>((resolve) => server.close(() => resolve()));
	return { baseURL: `http://${HOST}:${port}`, stop };
}

export type AppWithBackend = { app: AppServer; backend: FakeBackend; stop: () => Promise<void> };

// An app server reading the API (DATA_SOURCE=api) from a fake backend; if the
// app fails to start, the backend is closed before the error propagates.
export async function startAppWithBackend(
	handler: RequestListener,
	env: Record<string, string | undefined> = {}
): Promise<AppWithBackend> {
	const backend = await startFakeBackend(handler);
	const apiEnv = { DATA_SOURCE: 'api', BACKEND_API_BASE_URL: backend.baseURL, ...env };
	const app = await startAppServer(apiEnv).catch(async (err: unknown) => {
		await backend.stop();
		throw err;
	});
	const stop = async () => {
		await app.stop();
		await backend.stop();
	};
	return { app, backend, stop };
}
