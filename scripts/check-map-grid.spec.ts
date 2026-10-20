import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// D-FE4-1 outcome: "src/lib/map/map-grid.json is a copy of
// design/design_handoff_asadorov_desktop/map-grid.json, synced and
// drift-checked locally by a script (like tokens:check)". Unlike tokens.css
// nothing is stripped: the copy must be byte-identical (a reformatted or
// re-serialised file is drift too, so `sync` copies bytes, never JSON).
//
// Contract: scripts/check-map-grid.ts, flags --design <file> and --app
// <file> (defaults: the desktop bundle's map-grid.json and
// src/lib/map/map-grid.json) and --sync (copy design -> app, then exit 0).
// Without --sync it exits 0 when the bytes match, 1 (naming both files) when
// they differ or the app copy is missing, and 0 with "skipped" when the
// design file is absent (CI has no design bundle). Package scripts:
// `map-grid:check` and `map-grid:sync`, local only like tokens:check.

const repoRoot = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(import.meta.dirname, 'check-map-grid.ts');
const DESIGN_GRID = path.resolve(
	repoRoot,
	'../design/design_handoff_asadorov_desktop/map-grid.json'
);
const APP_GRID = path.resolve(repoRoot, 'src/lib/map/map-grid.json');
const GRID_JSON = '{\n  "columns": 14,\n  "rows": 11,\n  "grid": [\n    ".GGAABB......."\n  ]\n}';

type Run = { status: number | null; output: string };

let workDir = '';
afterEach(() => {
	if (workDir) rmSync(workDir, { recursive: true, force: true });
	workDir = '';
});

function tempFile(name: string, content?: string): string {
	workDir ||= mkdtempSync(path.join(tmpdir(), 'map-grid-'));
	const file = path.join(workDir, name);
	if (content !== undefined) writeFileSync(file, content);
	return file;
}

function runScript(...args: string[]): Run {
	const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
	return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function check(design: string, app: string): Run {
	return runScript('--design', design, '--app', app);
}

function expectExit(run: Run, want: number) {
	expect(run.status, `got exit ${run.status}, want ${want}; output:\n${run.output}`).toBe(want);
}

function packageScripts(): Record<string, string> {
	const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
		scripts?: Record<string, string>;
	};
	return pkg.scripts ?? {};
}

describe('check-map-grid --design --app', () => {
	it('exits 0 when the files are byte-identical', () => {
		expectExit(check(tempFile('design.json', GRID_JSON), tempFile('app.json', GRID_JSON)), 0);
	});

	const drift: { name: string; app: string }[] = [
		{ name: 'a changed cell', app: GRID_JSON.replace('.GG', '.GA') },
		{ name: 'only a trailing newline added', app: `${GRID_JSON}\n` },
		{ name: 'the same JSON re-indented', app: JSON.stringify(JSON.parse(GRID_JSON), null, '\t') },
		{ name: 'CRLF line endings', app: GRID_JSON.replaceAll('\n', '\r\n') }
	];
	for (const tc of drift) {
		it(`exits 1 naming both files for ${tc.name}`, () => {
			const design = tempFile('design.json', GRID_JSON);
			const app = tempFile('app.json', tc.app);
			const run = check(design, app);
			expectExit(run, 1);
			expect(run.output, 'want the output to name the design file').toContain(design);
			expect(run.output, 'want the output to name the app file').toContain(app);
		});
	}

	it('exits 1 when the app copy is missing', () => {
		const run = check(tempFile('design.json', GRID_JSON), tempFile('missing.json'));
		expectExit(run, 1);
	});

	it('exits 0 and says skipped when the design file is absent', () => {
		const run = check(tempFile('no-design.json'), tempFile('app.json', GRID_JSON));
		expectExit(run, 0);
		expect(run.output, `got ${JSON.stringify(run.output)}, want "skipped"`).toMatch(/skipped/i);
	});
});

describe('check-map-grid --sync', () => {
	it('copies the design file byte for byte, then the check passes', () => {
		const content = `${GRID_JSON.replaceAll('\n', '\r\n')}\n`;
		const design = tempFile('design.json', content);
		const app = tempFile('app.json', '{}');
		expectExit(runScript('--sync', '--design', design, '--app', app), 0);
		expect(readFileSync(app).equals(readFileSync(design)), 'got different bytes after sync').toBe(
			true
		);
		expectExit(check(design, app), 0);
	});

	it('creates the app copy when it does not exist yet', () => {
		const design = tempFile('design.json', GRID_JSON);
		const app = tempFile('new.json');
		expectExit(runScript('--sync', '--design', design, '--app', app), 0);
		expect(existsSync(app) && readFileSync(app, 'utf8'), 'got no copy').toBe(GRID_JSON);
	});
});

describe('package scripts', () => {
	const wanted: { name: string; mentions: string[] }[] = [
		{ name: 'map-grid:check', mentions: ['scripts/check-map-grid.ts'] },
		{ name: 'map-grid:sync', mentions: ['scripts/check-map-grid.ts', '--sync'] }
	];
	for (const { name, mentions } of wanted) {
		it(`defines ${name} running ${mentions.join(' ')}`, () => {
			const got = packageScripts()[name];
			expect(got, `got no ${name} script`).toBeTypeOf('string');
			for (const part of mentions) expect(got, `got ${JSON.stringify(got)}`).toContain(part);
		});
	}
});

describe.skipIf(!existsSync(DESIGN_GRID))('the real files', () => {
	it('`map-grid:check` passes: the bundled copy matches the design', () => {
		expect(existsSync(APP_GRID), `got no ${APP_GRID}`).toBe(true);
		expectExit(check(DESIGN_GRID, APP_GRID), 0);
		expectExit(runScript(), 0);
	});
});
