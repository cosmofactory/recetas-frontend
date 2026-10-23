import { readFileSync } from 'node:fs';
import { parseColour, type Rgba } from './contrast';
import { repoFile } from './load-export';

// The app's colour tokens as the browser sees them (Node specs only):
// tokens.css, then layout.css, so a layout.css override (stack.md X10
// contrast overrides) wins over the design value.
const TOKEN_FILES = ['src/lib/styles/tokens.css', 'src/lib/styles/layout.css'];

function declarations(): Map<string, string> {
	const css = TOKEN_FILES.map((file) => readFileSync(repoFile(file), 'utf8'))
		.join('\n')
		.replace(/\/\*[\s\S]*?\*\//g, '');
	return new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// A token whose value is another token (`--focus-ring: var(--ink)`) is followed.
const ALIAS = /^var\((--[\w-]+)\)$/;

export function tokenColour(name: string): Rgba {
	const value = declarations().get(name);
	if (value === undefined) throw new Error(`no ${name} in ${TOKEN_FILES.join(' or ')}`);
	const alias = ALIAS.exec(value);
	return alias ? tokenColour(alias[1]) : parseColour(value);
}
