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
const READY_TIMEOUT_MS = 30_000;
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
	if (child.exitCode !== null) return Promise.resolve();
	return new Promise((resolve) => {
		child.once('exit', () => resolve());
		child.kill();
	});
}

// `env` overrides the base environment; a value of undefined unsets it.
export async function startAppServer(env: Record<string, string | undefined>): Promise<AppServer> {
	const port = await freePort();
	const merged = { ...process.env, ...BASE_ENV, PORT: String(port), ...env };
	const child = spawn(process.execPath, [BUILD_DIR], { env: merged, stdio: 'ignore' });
	const baseURL = `http://${HOST}:${port}`;
	await expect
		.poll(() => healthStatus(baseURL), {
			message: `want node build on ${baseURL} healthy`,
			timeout: READY_TIMEOUT_MS
		})
		.toBe(200);
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
