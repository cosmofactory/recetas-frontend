import path from 'node:path';
import { expect } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');

// Imports `name` from a repo-relative module at run time, so a missing module
// or export fails as an assertion instead of a collection or type error.
export async function loadExport<T>(repoPath: string, name: string): Promise<T> {
	let mod: Record<string, unknown> = {};
	let loadError = '';
	try {
		mod = await import(/* @vite-ignore */ path.join(repoRoot, repoPath));
	} catch (err) {
		loadError = String(err);
	}
	expect(mod[name], `${repoPath} must export ${name} ${loadError}`).toBeDefined();
	return mod[name] as T;
}

export function repoFile(repoPath: string): string {
	return path.join(repoRoot, repoPath);
}
