// Drift check (FE-0): src/lib/styles/tokens.css must equal the design
// tokens.css minus its Google Fonts @import (D-FE0-1).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const googleFontsImport = /^@import url\(['"]?https:\/\/fonts\.googleapis\.com\/[^\n]*\n?/m;

function lines(css: string): string[] {
	return css.trim().split(/\r?\n/);
}

// Line diff via longest common subsequence; returns "-N: line" for lines only
// in the design file and "+N: line" for lines only in the app file.
export function diffTokens(designCss: string, appCss: string): string[] {
	const a = lines(designCss.replace(googleFontsImport, ''));
	const b = lines(appCss);
	const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0)
	);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}
	const out: string[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			i++;
			j++;
		} else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
			out.push(`-${i + 1}: ${a[i]}`);
			i++;
		} else {
			out.push(`+${j + 1}: ${b[j]}`);
			j++;
		}
	}
	return out;
}

function main(): number {
	const repoRoot = path.resolve(import.meta.dirname, '..');
	const { values } = parseArgs({
		options: {
			design: {
				type: 'string',
				default: path.resolve(repoRoot, '../design/design_handoff_asadorov_desktop/tokens.css')
			},
			app: { type: 'string', default: path.resolve(repoRoot, 'src/lib/styles/tokens.css') }
		}
	});
	const designPath = values.design;
	const appPath = values.app;
	if (!existsSync(designPath)) {
		console.log(`tokens:check skipped: no design tokens at ${designPath}`);
		return 0;
	}
	const diff = diffTokens(readFileSync(designPath, 'utf8'), readFileSync(appPath, 'utf8'));
	if (diff.length === 0) {
		console.log(`tokens:check ok: ${appPath} matches ${designPath}`);
		return 0;
	}
	console.error(`tokens:check drift (- ${designPath}, + ${appPath}):`);
	for (const line of diff) console.error(line);
	return 1;
}

if (import.meta.main) {
	process.exitCode = main();
}
