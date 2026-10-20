// Drift check (D-FE4-1): src/lib/map/map-grid.json is a byte-for-byte copy of
// the design map-grid.json. Bytes, not JSON: re-serialising or reformatting
// the copy is drift too, so --sync copies the file rather than rewriting it.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const repoRoot = path.resolve(import.meta.dirname, '..');
const DEFAULT_DESIGN = path.resolve(
	repoRoot,
	'../design/design_handoff_asadorov_desktop/map-grid.json'
);
const DEFAULT_APP = path.resolve(repoRoot, 'src/lib/map/map-grid.json');

type Files = { design: string; app: string };

function sync({ design, app }: Files): number {
	if (!existsSync(design)) {
		console.error(`map-grid:sync failed: no design map-grid.json at ${design}`);
		return 1;
	}
	mkdirSync(path.dirname(app), { recursive: true });
	copyFileSync(design, app);
	console.log(`map-grid:sync ok: copied ${design} to ${app}`);
	return 0;
}

function check({ design, app }: Files): number {
	if (!existsSync(design)) {
		console.log(`map-grid:check skipped: no design map-grid.json at ${design}`);
		return 0;
	}
	if (existsSync(app) && readFileSync(app).equals(readFileSync(design))) {
		console.log(`map-grid:check ok: ${app} matches ${design}`);
		return 0;
	}
	const problem = existsSync(app) ? 'differs from' : 'is missing; want a copy of';
	console.error(`map-grid:check drift: ${app} ${problem} ${design} (run pnpm map-grid:sync)`);
	return 1;
}

function main(): number {
	const { values } = parseArgs({
		options: {
			design: { type: 'string', default: DEFAULT_DESIGN },
			app: { type: 'string', default: DEFAULT_APP },
			sync: { type: 'boolean', default: false }
		}
	});
	const files = { design: values.design, app: values.app };
	return values.sync ? sync(files) : check(files);
}

if (import.meta.main) {
	process.exitCode = main();
}
