import { browser } from '$app/env';
import { snapshot } from '$app/navigation';

export type EntrySnapshot<T> = { id: string; capture: () => T; restore: (value: T) => void };

// D-FE6-1: state kept per history entry (SvelteKit `snapshot`), captured on
// leaving the entry and restored on coming back to it. Kit's server build
// makes `snapshot` a no-op, so it is only registered in the browser. Call
// during component init; the explicit id keeps it stable across deployments.
export function entrySnapshot<T>(options: EntrySnapshot<T>): void {
	if (browser) snapshot(options);
}
