import type { Page } from '@playwright/test';

// stack.md X6 (no storage, one cookie): a Playwright init script that
// records every storage and cookie write before any app code runs. Shared by
// privacy.e2e.ts and the FE-7 search overlay spec.

export function installStorageSpy() {
	const writes: string[] = [];
	(window as unknown as { __writes: string[] }).__writes = writes;
	for (const method of ['setItem', 'removeItem', 'clear'] as const) {
		const original = Storage.prototype[method];
		Storage.prototype[method] = function (this: Storage, ...args: unknown[]) {
			writes.push(`Storage.${method}(${JSON.stringify(args)})`);
			return (original as (...a: unknown[]) => unknown).apply(this, args);
		} as never;
	}
	const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
	Object.defineProperty(Document.prototype, 'cookie', {
		configurable: true,
		get: cookie.get,
		set(value: string) {
			writes.push(`document.cookie = ${value}`);
			cookie.set!.call(this, value);
		}
	});
	const open = IDBFactory.prototype.open;
	IDBFactory.prototype.open = function (this: IDBFactory, ...args: Parameters<typeof open>) {
		writes.push(`indexedDB.open(${String(args[0])})`);
		return open.apply(this, args);
	};
}

export function recordedWrites(page: Page): Promise<string[]> {
	return page.evaluate(() => (window as unknown as { __writes: string[] }).__writes);
}
