import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../src/testutil/load-export';
import { CSS_NAMED_COLOURS, CSS_SYSTEM_COLOURS } from './testdata/css-named-colours';

// FE-3: `pnpm check:colors` (part of `pnpm lint`) fails on colour literals
// outside the token files: tokens.css (the design mirror) and layout.css
// (FE-3 layout tokens) are the only place a colour is written. Every other
// colour is a var(--token). Stage FE-3 -> Foundations: "forbids hex or rgba
// literals in components outside the tokens file".
//
// What counts as a colour literal: a hex colour #rgb, #rgba, #rrggbb or
// #rrggbbaa (any case, not followed by more word characters or "-"); a call
// to a colour function, rgb() rgba() hsl() hsla() hwb() lab() lch() oklab()
// oklch() color() color-mix() (any case; review: color-mix() of tokens is
// still a colour made outside the token files); and, in CSS values only, a
// CSS named colour as a whole word (any case). The keywords transparent,
// currentcolor, inherit, initial, unset and revert are allowed.
//
// Where it is looked for, so that hex-looking text that isn't a colour is
// left alone:
// - CSS (.css files, .svelte <style> blocks): declaration values only, so
//   `#id` selectors, `url(#fragment)` and comments are fine.
// - .svelte markup: the `style` attribute, `style:` directives and the SVG
//   colour attributes (fill, stroke, stop-color, flood-color, lighting-color,
//   color), both static text and string literals in expressions. Hrefs (`#main`
//   anchors), ids and other attributes are never checked.
// - Script (.ts files, .svelte <script>): string and template literals only,
//   and only hex and colour functions (a word like 'tan' in a string is not
//   CSS). Comments, `#private` fields and identifiers are skipped; import
//   specifiers like '#lib/media.ts' are strings but not colours.
// Named colours count in CSS values: declaration values, style attributes and
// style: directives (static text and string literals in expressions) and the
// SVG colour attributes. Property names, selectors, other keywords (none,
// auto), url() and quoted strings (content: "red") are not values.
// Scanned: src/**/*.{svelte,css,ts}, minus the two token files, Paraglide
// output and test code (specs, e2e and src/testutil compare computed colours).

type Violation = { line: number; message: string };
type FindColorLiterals = (source: string, filename: string) => Violation[];
type IsCheckedFile = (repoPath: string) => boolean;

const SCRIPT = repoFile('scripts/check-colors.ts');

function exec(file: string, args: string[], cwd?: string): { status: number; output: string } {
	try {
		const stdout = execFileSync(file, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
		return { status: 0, output: stdout };
	} catch (err) {
		const e = err as { status?: number; stdout?: string; stderr?: string };
		return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
	}
}

const find = () => loadExport<FindColorLiterals>('scripts/check-colors.ts', 'findColorLiterals');
const isChecked = () => loadExport<IsCheckedFile>('scripts/check-colors.ts', 'isCheckedFile');

type Case = { name: string; source: string };
type BadCase = Case & { literal: string; line: number };

async function expectClean(cases: Case[], filename: string) {
	const findColorLiterals = await find();
	for (const tc of cases) {
		const got = findColorLiterals(tc.source, filename);
		expect(got, `${tc.name}: got ${JSON.stringify(got)}, want []`).toEqual([]);
	}
}

function itReportsEach(cases: BadCase[], filename: string) {
	for (const tc of cases) {
		it(`reports ${tc.name} on line ${tc.line}`, async () => {
			const got = (await find())(tc.source, filename);
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			expect(got[0].line, `got line ${got[0].line}, want ${tc.line}`).toBe(tc.line);
			expect(got[0].message, `got "${got[0].message}", want it to quote ${tc.literal}`).toContain(
				tc.literal
			);
		});
	}
}

describe('findColorLiterals in CSS', () => {
	it('reports nothing for tokens, keywords, selectors, fragments and comments', async () => {
		await expectClean(
			[
				{ name: 'a token', source: '.a { color: var(--ink); }' },
				{ name: 'a token fallback chain', source: '.a { color: var(--x, var(--ink)); }' },
				{
					name: 'colour keywords',
					source: '.a { color: currentColor; background: transparent; border-color: inherit; }'
				},
				{ name: 'a hex-looking id selector', source: '#bad { color: var(--ink); }' },
				{
					name: 'a hex-looking id in a compound selector',
					source: 'a#fed:hover, #add > p { color: var(--ink); }'
				},
				{ name: 'an SVG fragment url', source: '.a { filter: url(#bad); mask: url("#add"); }' },
				{
					name: 'a comment',
					source: '/* was #fff and rgba(0,0,0,.1), now tokens */ .a { color: var(--ink); }'
				},
				{ name: 'a non-colour hex length', source: '.a { --n: #abcde; }' },
				{ name: 'a function whose name ends in rgb', source: '.a { color: myrgb(1); }' },
				{
					name: 'the allowed colour keywords, any case',
					source:
						'.a { color: transparent; color: currentcolor; color: CurrentColor; color: inherit; color: initial; color: unset; color: revert; }'
				},
				{ name: 'other keywords', source: '.a { outline: none; margin: auto; display: block; }' },
				{
					name: 'colour-named selectors',
					source: '.red, a.tan, #white > .navy { color: var(--ink); }'
				},
				{ name: 'a colour-named custom property name', source: ':root { --red: var(--accent); }' },
				{ name: 'a colour-named token in var()', source: '.a { color: var(--white); }' },
				{
					name: 'colour words inside a quoted string',
					source: '.a::after { content: "red tan white"; font-family: "Golos Text"; }'
				},
				{
					name: 'a colour word in a url()',
					source: '.a { background-image: url(images/red.png); }'
				},
				{
					name: 'a colour word inside a hyphenated keyword',
					source: '.a { animation: snow-fall 1s; }'
				},
				{
					name: 'property names',
					source: '.a { color: var(--ink); background-color: var(--bg-page); }'
				}
			],
			'Clean.css'
		);
	});

	itReportsEach(
		[
			{ name: 'a 3-digit hex', source: '.a { color: #fff; }', literal: '#fff', line: 1 },
			{ name: 'a 4-digit hex', source: '.a { color: #fffa; }', literal: '#fffa', line: 1 },
			{
				name: 'an upper-case 6-digit hex',
				source: '.a {\n\tcolor: #C4552E;\n}',
				literal: '#C4552E',
				line: 2
			},
			{ name: 'an 8-digit hex', source: '.a { color: #2b1e16cc; }', literal: '#2b1e16cc', line: 1 },
			{ name: 'rgb()', source: '.a { color: rgb(1 2 3); }', literal: 'rgb(', line: 1 },
			{
				name: 'rgba() in a shadow',
				source: '.a { box-shadow: 0 10px 26px rgba(43,30,22,.1); }',
				literal: 'rgba(',
				line: 1
			},
			{ name: 'hsl()', source: '.a { color: hsl(20 50% 40%); }', literal: 'hsl(', line: 1 },
			{
				name: 'upper-case HSLA()',
				source: '.a { color: HSLA(20, 50%, 40%, .5); }',
				literal: 'HSLA(',
				line: 1
			},
			{ name: 'hwb()', source: '.a { color: hwb(20 10% 30%); }', literal: 'hwb(', line: 1 },
			{ name: 'lab()', source: '.a { color: lab(50% 40 59); }', literal: 'lab(', line: 1 },
			{ name: 'lch()', source: '.a { color: lch(52% 72 56); }', literal: 'lch(', line: 1 },
			{ name: 'oklab()', source: '.a { color: oklab(59% 0.1 0.1); }', literal: 'oklab(', line: 1 },
			{ name: 'oklch()', source: '.a { color: OKLCH(60% 0.15 40); }', literal: 'OKLCH(', line: 1 },
			{
				name: 'color()',
				source: '.a { color: color(display-p3 1 0 0); }',
				literal: 'color(',
				line: 1
			},
			{
				name: 'color-mix(), even of tokens',
				source: '.a { color: color-mix(in srgb, var(--ink) 50%, transparent); }',
				literal: 'color-mix(',
				line: 1
			},
			{ name: 'a named colour', source: '.a { color: red; }', literal: 'red', line: 1 },
			{
				name: 'a capitalised named colour in a shorthand',
				source: '.a {\n\tborder: 1px solid White;\n}',
				literal: 'White',
				line: 2
			},
			{
				name: 'a named colour in a custom property',
				source: ':root { --x: rebeccapurple; }',
				literal: 'rebeccapurple',
				line: 1
			},
			{
				name: 'a custom property defined as a colour',
				source: ':root { --x: #fff; }',
				literal: '#fff',
				line: 1
			},
			{
				name: 'a hex inside a media query',
				source:
					'.a { color: var(--ink); }\n\n@media (hover: hover) {\n\t.a:hover { background: #FDFAF3; }\n}',
				literal: '#FDFAF3',
				line: 4
			}
		],
		'Bad.css'
	);

	it('reports every CSS named colour', async () => {
		const findColorLiterals = await find();
		const missed = CSS_NAMED_COLOURS.filter(
			(name) => findColorLiterals(`.a { color: ${name}; }`, 'Bad.css').length !== 1
		);
		expect(missed, `got no single violation for ${JSON.stringify(missed)}`).toEqual([]);
	});

	// FE-3 re-review: system colours (CSS Color 4) are colour literals too.
	it('reports every CSS system colour, in any case', async () => {
		const findColorLiterals = await find();
		const sources = CSS_SYSTEM_COLOURS.flatMap((name) => [
			name,
			name.toLowerCase(),
			name.toUpperCase()
		]);
		const missed = sources.filter(
			(name) => findColorLiterals(`.a { color: ${name}; }`, 'Bad.css').length !== 1
		);
		expect(missed, `got no single violation for ${JSON.stringify(missed)}`).toEqual([]);
	});

	it('reports a system colour in a style attribute', async () => {
		const got = (await find())('<div style="background: Canvas"></div>', 'Bad.svelte');
		expect(got.map((v) => v.message).join(), `got ${JSON.stringify(got)}`).toContain('Canvas');
	});

	it('leaves system-colour words alone outside CSS values', async () => {
		await expectClean(
			[
				{ name: 'a class and a selector', source: '.mark, .highlight { color: var(--ink); }' },
				{ name: 'a hyphenated keyword', source: '.a { grid-area: field-text; }' },
				{ name: 'a quoted string', source: '.a::after { content: "Canvas Mark"; }' }
			],
			'Clean.css'
		);
	});

	it('reports each literal separately, with its own line', async () => {
		const got = (await find())('.a {\n\tcolor: #fff;\n\tbackground: rgb(0 0 0);\n}', 'Bad.css');
		expect(
			got.map((v) => v.line),
			`got ${JSON.stringify(got)}`
		).toEqual([2, 3]);
	});
});

describe('findColorLiterals in .svelte files', () => {
	it('reports nothing for anchors, ids, imports, comments and token styles', async () => {
		await expectClean(
			[
				{ name: 'an anchor href', source: '<a href="#add">{label}</a>' },
				{ name: 'an SVG <use> fragment', source: '<svg><use href="#fade" /></svg>' },
				{ name: 'a hex-looking id and class', source: '<div id="bad" class="fed"></div>' },
				{
					name: 'a #lib import',
					source: "<script>\n\timport Photo from '#lib/components/Photo.svelte';\n</script>"
				},
				{
					name: 'a script comment',
					source: '<script>\n\t// was #fff\n\tlet a = 1;\n</script>\n<p>{a}</p>'
				},
				{
					name: 'a style block of tokens',
					source: '<p>{a}</p>\n<style>\n\tp { color: var(--ink); }\n</style>'
				},
				{
					name: 'a hex-looking id selector in <style>',
					source: '<style>\n\t#bad { color: var(--ink); }\n</style>'
				},
				{ name: 'a style attribute of tokens', source: '<div style="color: var(--ink)"></div>' },
				{
					name: 'a style attribute with an expression',
					source: '<div style="--h: {height}"></div>'
				},
				{ name: 'a style directive with a token', source: '<div style:color="var(--ink)"></div>' },
				{ name: 'a fill with a token', source: '<svg><path fill="var(--accent)" /></svg>' },
				{ name: 'text that looks like a hex', source: '<p>{m.x()} #add</p>' },
				{
					name: 'colour-named classes and text',
					source: '<div class="red tan">{m.x()} white</div>'
				},
				{
					name: 'a colour-named token in a style attribute',
					source: '<div style="--x: var(--red)"></div>'
				},
				{
					name: 'SVG colour keywords',
					source: '<svg><path fill="none" stroke="currentColor" /></svg>'
				},
				{
					name: 'a colour-named identifier in <script>',
					source: '<script>\n\tconst red = 1;\n</script>\n<p>{red}</p>'
				}
			],
			'Clean.svelte'
		);
	});

	itReportsEach(
		[
			{
				name: 'a hex in the <style> block (lines count from the file start)',
				source:
					'<script>\n\tlet a = 1;\n</script>\n\n<p>{a}</p>\n\n<style>\n\tp {\n\t\tcolor: #2B1E16;\n\t}\n</style>',
				literal: '#2B1E16',
				line: 9
			},
			{
				name: 'rgba() in :global() in <style>',
				source: '<style>\n\t:global(.a) { background: rgba(0,0,0,.5); }\n</style>',
				literal: 'rgba(',
				line: 2
			},
			{
				name: 'a hex in a style attribute',
				source: '<div style="color: #fff"></div>',
				literal: '#fff',
				line: 1
			},
			{
				name: 'a hex in a style attribute expression',
				source: "<div style={open ? 'color: #fff' : ''}></div>",
				literal: '#fff',
				line: 1
			},
			{
				name: 'a hex in a style directive',
				source: '<div style:background="#C4552E"></div>',
				literal: '#C4552E',
				line: 1
			},
			{
				name: 'a hex fill on SVG',
				source: '<svg>\n\t<path fill="#C4552E" />\n</svg>',
				literal: '#C4552E',
				line: 2
			},
			{
				name: 'an rgba stroke on SVG',
				source: '<svg><path stroke="rgba(43,30,22,.2)" /></svg>',
				literal: 'rgba(',
				line: 1
			},
			{
				name: 'a named colour in a style attribute',
				source: '<div style="color: red"></div>',
				literal: 'red',
				line: 1
			},
			{
				name: 'a named colour in a style attribute expression',
				source: "<div style={open ? 'background: white' : ''}></div>",
				literal: 'white',
				line: 1
			},
			{
				name: 'a named colour in a style directive',
				source: '<div style:color="tomato"></div>',
				literal: 'tomato',
				line: 1
			},
			{
				name: 'a named SVG fill',
				source: '<svg><path fill="white" /></svg>',
				literal: 'white',
				line: 1
			},
			{
				name: 'oklch() in <style>',
				source: '<style>\n\tp { color: oklch(60% 0.15 40); }\n</style>',
				literal: 'oklch(',
				line: 2
			},
			{
				name: 'a named colour in <style>',
				source: '<p>{a}</p>\n<style>\n\tp { color: black; }\n</style>',
				literal: 'black',
				line: 3
			},
			{
				name: 'a hex string in <script>',
				source: "<script>\n\tconst tile = '#9A9A5E';\n</script>\n<p>{tile}</p>",
				literal: '#9A9A5E',
				line: 2
			}
		],
		'Bad.svelte'
	);
});

describe('findColorLiterals in .ts files', () => {
	it('reports nothing for imports, private fields, comments, identifiers and non-colours', async () => {
		await expectClean(
			[
				{ name: 'a #lib import', source: "import { imageSet } from '#lib/media.ts';" },
				{
					name: 'a #private field',
					source: 'class A {\n\t#bad = 1;\n\tget() {\n\t\treturn this.#bad;\n\t}\n}'
				},
				{
					name: 'line and block comments',
					source: '// #fff\n/* rgba(0,0,0,.1) */\nexport const a = 1;'
				},
				{ name: 'a function named rgb', source: 'const rgb = (n: number) => n;\nrgb(1);' },
				{ name: 'an anchor string', source: "const hash = '#main';" },
				{ name: 'a hex-looking id with a suffix', source: "const id = '#fade-in';" },
				{ name: 'a non-colour hex length', source: "const n = '#12345';" },
				{
					name: 'colour-named identifiers',
					source: 'const red = 1;\nfunction white(tan: number) {\n\treturn tan + red;\n}'
				},
				{ name: 'a colour word in a plain string', source: "const role = 'gold';" },
				{ name: 'a function named color', source: 'const color = (n: number) => n;\ncolor(1);' }
			],
			'clean.ts'
		);
	});

	itReportsEach(
		[
			{
				name: 'a single-quoted hex',
				source: "export const tile = '#C4552E';",
				literal: '#C4552E',
				line: 1
			},
			{
				name: 'a double-quoted rgba',
				source: '\nconst shade = "rgba(43,30,22,.1)";',
				literal: 'rgba(',
				line: 2
			},
			{
				name: 'a template hsl',
				source: 'const c = (h: number) =>\n\t`hsl(${h} 50% 50%)`;',
				literal: 'hsl(',
				line: 2
			},
			{
				name: 'an oklch() string',
				source: "export const accent = 'oklch(60% 0.15 40)';",
				literal: 'oklch(',
				line: 1
			},
			{
				name: 'a color-mix() string',
				source: "const mix = 'color-mix(in srgb, var(--ink) 50%, transparent)';",
				literal: 'color-mix(',
				line: 1
			}
		],
		'bad.ts'
	);
});

describe('isCheckedFile', () => {
	const files: { file: string; checked: boolean }[] = [
		{ file: 'src/lib/components/ui/Chip.svelte', checked: true },
		{ file: 'src/routes/+layout.svelte', checked: true },
		{ file: 'src/lib/styles/global.css', checked: true },
		{ file: 'src/lib/styles/fonts.css', checked: true },
		{ file: 'src/lib/ui/motion.svelte.ts', checked: true },
		{ file: 'src/lib/media.ts', checked: true },
		{ file: 'src/lib/styles/tokens.css', checked: false },
		{ file: 'src/lib/styles/layout.css', checked: false },
		{ file: 'src/lib/components/Photo.svelte.spec.ts', checked: false },
		{ file: 'src/lib/media.spec.ts', checked: false },
		{ file: 'src/routes/foundation.e2e.ts', checked: false },
		{ file: 'src/testutil/catalog.ts', checked: false },
		{ file: 'src/testutil/ChipRowHarness.svelte', checked: false },
		{ file: 'src/lib/paraglide/runtime.js', checked: false },
		{ file: 'scripts/check-colors.ts', checked: false },
		{ file: 'README.md', checked: false }
	];
	for (const { file, checked } of files) {
		it(`${checked ? 'checks' : 'skips'} ${file}`, async () => {
			expect((await isChecked())(file)).toBe(checked);
		});
	}
});

describe('check-colors CLI', () => {
	const roots: string[] = [];
	afterEach(() =>
		roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
	);

	function fixtureRoot(files: Record<string, string>): string {
		const root = mkdtempSync(path.join(tmpdir(), 'check-colors-'));
		roots.push(root);
		for (const [file, source] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			writeFileSync(path.join(root, file), source);
		}
		return root;
	}

	const run = (root: string) => exec(process.execPath, [SCRIPT, root]);

	it('exits 1 and reports file:line for each literal in a scanned file, given a root', async () => {
		const root = fixtureRoot({
			'src/lib/components/Bad.svelte': '<p>{a}</p>\n\n<style>\n\tp { color: #fff; }\n</style>\n',
			'src/lib/styles/tokens.css': ':root { --ink: #2B1E16; }\n',
			'src/lib/styles/layout.css': ':root { --shadow-x: 0 1px 2px rgba(0,0,0,.1); }\n',
			'src/lib/thing.spec.ts': "const want = 'rgb(1, 2, 3)';\n"
		});
		const { status, output } = run(root);
		expect(status, `got exit ${status}, want 1; output:\n${output}`).toBe(1);
		expect(output).toContain('src/lib/components/Bad.svelte:4:');
		expect(output, 'got a report for an excluded file').not.toMatch(
			/tokens\.css|layout\.css|thing\.spec\.ts/
		);
	});

	it('exits 0 when no scanned file has a literal', async () => {
		const root = fixtureRoot({
			'src/lib/components/Good.svelte': '<p>{a}</p>\n<style>p { color: var(--ink); }</style>\n'
		});
		const { status, output } = run(root);
		expect(status, `got exit ${status}, want 0; output:\n${output}`).toBe(0);
	});
});

describe('pnpm check:colors', () => {
	const scripts = () =>
		(
			JSON.parse(readFileSync(repoFile('package.json'), 'utf8')) as {
				scripts?: Record<string, string>;
			}
		).scripts ?? {};

	it('is a package script that `pnpm lint` runs', () => {
		const { lint, ...rest } = scripts();
		expect(rest['check:colors'], 'got no check:colors script, want one').toBeTypeOf('string');
		expect(lint, `got lint "${lint}", want it to run check:colors`).toContain('check:colors');
	});

	it('passes on the repository', () => {
		const { status, output } = exec('pnpm', ['run', '--silent', 'check:colors'], repoFile('.'));
		expect(status, `got exit ${status}, want 0; output:\n${output}`).toBe(0);
	});
});
