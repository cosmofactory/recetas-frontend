import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The drift check (FE-0): src/lib/styles/tokens.css must equal the design
// tokens.css minus its Google Fonts @import (D-FE0-1). Nothing else may differ.

type DiffTokens = (designCss: string, appCss: string) => string[];

const repoRoot = path.resolve(import.meta.dirname, '..');
const designPath = path.resolve(repoRoot, '../design/design_handoff_asadorov_desktop/tokens.css');
const appPath = path.resolve(repoRoot, 'src/lib/styles/tokens.css');

// Loaded dynamically so a missing module fails as an assertion, not a
// collection error.
async function loadDiffTokens(): Promise<DiffTokens> {
	const modulePath = path.join(import.meta.dirname, 'check-tokens.ts');
	let mod: { diffTokens?: unknown } = {};
	let loadError = '';
	try {
		mod = await import(/* @vite-ignore */ modulePath);
	} catch (err) {
		loadError = String(err);
	}
	expect(typeof mod.diffTokens, `scripts/check-tokens.ts must export diffTokens ${loadError}`).toBe(
		'function'
	);
	return mod.diffTokens as DiffTokens;
}

const googleImport =
	"@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@400;500;600;700&family=Cormorant+Garamond:wght@500&family=Golos+Text:wght@400;500;600;700&display=swap');";

const body = `:root {
  --bg-page: #F6EFE3;
  --ink: #2B1E16;
  --accent: #C4552E;
  --font-text: 'Archivo', 'Golos Text', system-ui, sans-serif;
}
`;

const header = '/* Asadorov tokens as CSS custom properties. Mirrors tokens.json exactly. */\n';
const design = `${header}${googleImport}\n\n${body}`;
const app = `${header}\n${body}`;

describe('diffTokens', () => {
	const inSync: { name: string; designCss: string; appCss: string }[] = [
		{ name: 'identical files', designCss: app, appCss: app },
		{ name: 'design has the Google Fonts @import, app does not', designCss: design, appCss: app },
		{ name: 'trailing newline differs', designCss: design, appCss: app.trimEnd() },
		{ name: 'leading whitespace differs', designCss: design, appCss: `\n\n${app}` }
	];
	for (const tc of inSync) {
		it(`returns [] when in sync: ${tc.name}`, async () => {
			const diffTokens = await loadDiffTokens();
			const got = diffTokens(tc.designCss, tc.appCss);
			expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
		});
	}

	const drift: { name: string; appCss: string; mentions: string }[] = [
		{
			name: 'a changed value',
			appCss: app.replace('--accent: #C4552E;', '--accent: #C4552F;'),
			mentions: '--accent'
		},
		{
			name: 'a missing variable',
			appCss: app.replace('  --ink: #2B1E16;\n', ''),
			mentions: '--ink'
		},
		{
			name: 'an extra variable in the app',
			appCss: app.replace(
				'  --accent: #C4552E;\n',
				'  --accent: #C4552E;\n  --accent-2: #000000;\n'
			),
			mentions: '--accent-2'
		},
		{
			name: 'a changed font stack',
			appCss: app.replace("'Archivo', 'Golos Text'", "'Archivo'"),
			mentions: '--font-text'
		},
		{
			// Only the design's @import is ignored; the app must not reintroduce a
			// third-party font request (D-FE0-1).
			name: 'the app keeps the Google Fonts @import',
			appCss: design,
			mentions: 'fonts.googleapis.com'
		},
		{
			name: 'a changed comment (nothing but the @import is ignored)',
			appCss: app.replace('Mirrors tokens.json exactly.', 'Mirrors tokens.json.'),
			mentions: 'Mirrors tokens.json'
		}
	];
	for (const tc of drift) {
		it(`reports drift: ${tc.name}`, async () => {
			const diffTokens = await loadDiffTokens();
			const got = diffTokens(design, tc.appCss);
			expect(got.length, `got ${JSON.stringify(got)}, want a non-empty diff`).toBeGreaterThan(0);
			expect(
				got.join('\n'),
				`got ${JSON.stringify(got)}, want a difference mentioning ${tc.mentions}`
			).toContain(tc.mentions);
		});
	}

	it('returns only strings', async () => {
		const diffTokens = await loadDiffTokens();
		const got = diffTokens(design, app.replace('#F6EFE3', '#FFFFFF'));
		for (const line of got) {
			expect(typeof line, `got ${typeof line}, want string`).toBe('string');
		}
		expect(got.length).toBeGreaterThan(0);
	});
});

// The design bundle lives outside this repo (workspace sibling). Where it is
// absent (e.g. a bare CI checkout) these tests are skipped.
const haveDesign = existsSync(designPath);

describe.skipIf(!haveDesign)('real tokens files', () => {
	it('src/lib/styles/tokens.css is in sync with the design tokens.css', async () => {
		const diffTokens = await loadDiffTokens();
		expect(existsSync(appPath), `got no file at ${appPath}, want the copied tokens`).toBe(true);
		const got = diffTokens(readFileSync(designPath, 'utf8'), readFileSync(appPath, 'utf8'));
		expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
	});

	it('src/lib/styles/tokens.css has no @import (fonts are self-hosted)', () => {
		expect(existsSync(appPath), `got no file at ${appPath}, want the copied tokens`).toBe(true);
		const css = readFileSync(appPath, 'utf8');
		expect(css, 'got an @import, want none').not.toMatch(/@import/);
		expect(css, 'got a Google Fonts reference, want none').not.toMatch(
			/fonts\.(googleapis|gstatic)\.com/
		);
	});

	it('`pnpm tokens:check` exits 0 when the files are in sync', () => {
		const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
			scripts?: Record<string, string>;
		};
		expect(pkg.scripts?.['tokens:check'], 'got no tokens:check script, want one').toBeTypeOf(
			'string'
		);
		let status = 0;
		let output = '';
		try {
			execFileSync('pnpm', ['run', '--silent', 'tokens:check'], {
				cwd: repoRoot,
				encoding: 'utf8',
				stdio: 'pipe'
			});
		} catch (err) {
			const e = err as { status?: number; stdout?: string; stderr?: string };
			status = e.status ?? 1;
			output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
		}
		expect(status, `got exit ${status}, want 0; output:\n${output}`).toBe(0);
	});
});
