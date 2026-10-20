// FE-3: colours are written only in the token files (tokens.css, the design
// mirror, and layout.css); everything else uses var(--token). Fails on a hex
// colour or a colour function (rgb() … oklch(), color(), color-mix()) in CSS
// values, .svelte style attributes, style: directives, SVG colour attributes
// and script strings, and on a CSS named or system colour in CSS values (a word like
// 'tan' in a script string is not CSS). Selectors, property names, url(),
// quoted CSS strings, hrefs, comments and identifiers are never checked, so
// `#id`, `.red` and `#private` pass.
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { CSS_NAMED_COLOURS } from './css-named-colours.ts';
import { CSS_SYSTEM_COLOURS } from './css-system-colours.ts';

export type Violation = { line: number; message: string };

// A piece of source to scan, where it starts in the file, and whether it is
// a CSS value (where named colours count too).
type Chunk = { start: number; text: string; css: boolean };

type TemplateNode = {
	type?: string;
	start: number;
	end: number;
	name?: string;
	value?: unknown;
	expression?: { start: number; end: number };
	attributes?: TemplateNode[];
};

const TOKEN_FILES = new Set(['src/lib/styles/tokens.css', 'src/lib/styles/layout.css']);
const EXCLUDED_DIRS = ['src/lib/paraglide/', 'src/testutil/'];
const TEST_FILE = /\.(spec|test|e2e)\.ts$/;
const SCANNED_FILE = /\.(svelte|css|ts)$/;
const COLOUR_FUNCTIONS = [
	'rgba?',
	'hsla?',
	'hwb',
	'lab',
	'lch',
	'oklab',
	'oklch',
	'color-mix',
	'color'
];
const COLOUR_LITERAL = new RegExp(
	`#(?:[\\da-f]{8}|[\\da-f]{6}|[\\da-f]{3,4})(?![\\w-])|(?<![\\w-])(?:${COLOUR_FUNCTIONS.join('|')})\\(`,
	'gi'
);
const COLOUR_KEYWORDS = [...CSS_NAMED_COLOURS, ...CSS_SYSTEM_COLOURS];
const NAMED_COLOUR = new RegExp(`(?<![\\w#-])(?:${COLOUR_KEYWORDS.join('|')})(?![\\w-])`, 'gi');
const SVG_COLOUR_ATTRIBUTES = new Set([
	'fill',
	'stroke',
	'stop-color',
	'flood-color',
	'lighting-color',
	'color'
]);
const STRING_KINDS = new Set([
	ts.SyntaxKind.StringLiteral,
	ts.SyntaxKind.NoSubstitutionTemplateLiteral,
	ts.SyntaxKind.TemplateHead,
	ts.SyntaxKind.TemplateMiddle,
	ts.SyntaxKind.TemplateTail
]);

export function isCheckedFile(repoPath: string): boolean {
	if (!repoPath.startsWith('src/') || !SCANNED_FILE.test(repoPath)) return false;
	if (TOKEN_FILES.has(repoPath) || TEST_FILE.test(repoPath)) return false;
	return !EXCLUDED_DIRS.some((dir) => repoPath.startsWith(dir));
}

// Same length, same line breaks, so offsets still point into the original.
function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

function withoutNonValues(css: string): string {
	return css
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/url\([^)]*\)/gi, blank)
		.replace(/"[^"]*"|'[^']*'/g, blank);
}

// A chunk a `;` or `}` ends is a declaration; one a `{` ends is a selector
// or an at-rule prelude, which can hold `#id` and `:hover` but no colour.
function cssValues(css: string, offset: number): Chunk[] {
	const values: Chunk[] = [];
	for (const match of withoutNonValues(css).matchAll(/([^{};]*)([{};]?)/g)) {
		const [, body, end] = match;
		const colon = body.indexOf(':');
		if (end === '{' || colon < 0) continue;
		const start = offset + match.index + colon + 1;
		values.push({ start, text: body.slice(colon + 1), css: true });
	}
	return values;
}

// A bare value (a style: directive, an SVG attribute).
function cssValue(text: string, offset: number): Chunk[] {
	return [{ start: offset, text: withoutNonValues(text), css: true }];
}

// The text of every string and template literal, past its opening quote.
function scriptStrings(code: string, offset: number): Chunk[] {
	const file = ts.createSourceFile('chunk.ts', code, ts.ScriptTarget.Latest);
	const strings: Chunk[] = [];
	const visit = (node: ts.Node) => {
		if (STRING_KINDS.has(node.kind)) {
			const { text } = node as ts.LiteralLikeNode;
			strings.push({ start: offset + node.getStart(file) + 1, text, css: false });
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return strings;
}

type ToCss = (text: string, offset: number) => Chunk[];

// An attribute's value as parts: "a {b} c" -> [Text, ExpressionTag, Text].
function valueParts(attribute: TemplateNode): TemplateNode[] {
	const value = attribute.value;
	if (Array.isArray(value)) return value as TemplateNode[];
	return value && typeof value === 'object' ? [value as TemplateNode] : [];
}

// Static text and the strings an expression can produce, read as CSS.
function partChunks(source: string, part: TemplateNode, toCss: ToCss): Chunk[] {
	const { expression } = part;
	if (!expression) return toCss(source.slice(part.start, part.end), part.start);
	const code = source.slice(expression.start, expression.end);
	return scriptStrings(code, expression.start).flatMap((s) => toCss(s.text, s.start));
}

// style="a: b" holds declarations; a string without a colon is a lone value.
const styleAttributeCss: ToCss = (text, offset) =>
	text.includes(':') ? cssValues(text, offset) : cssValue(text, offset);

function attributeCss(node: TemplateNode): ToCss | undefined {
	if (node.type === 'StyleDirective') return cssValue;
	if (node.type !== 'Attribute') return undefined;
	if (node.name === 'style') return styleAttributeCss;
	return SVG_COLOUR_ATTRIBUTES.has(node.name ?? '') ? cssValue : undefined;
}

function attributeChunks(source: string, element: TemplateNode): Chunk[] {
	return (element.attributes ?? []).flatMap((attribute) => {
		const toCss = attributeCss(attribute);
		if (!toCss) return [];
		return valueParts(attribute).flatMap((part) => partChunks(source, part, toCss));
	});
}

// Every element's colour attributes, anywhere in the template. Attribute
// values are judged by attributeChunks and not walked further.
function markupChunks(source: string, value: unknown): Chunk[] {
	if (Array.isArray(value)) return value.flatMap((item) => markupChunks(source, item));
	if (value === null || typeof value !== 'object') return [];
	const node = value as TemplateNode;
	const own = Array.isArray(node.attributes) ? attributeChunks(source, node) : [];
	const children = Object.entries(node).filter(([key]) => key !== 'attributes');
	return [...own, ...children.flatMap(([, child]) => markupChunks(source, child))];
}

type Section = { start: number; end: number };

function sectionStrings(source: string, section: Section | undefined): Chunk[] {
	return section ? scriptStrings(source.slice(section.start, section.end), section.start) : [];
}

function svelteChunks(source: string, filename: string): Chunk[] {
	const ast = parse(source, { modern: true, filename });
	const css = ast.css ? cssValues(ast.css.content.styles, ast.css.content.start) : [];
	return [
		...sectionStrings(source, ast.module?.content as Section | undefined),
		...sectionStrings(source, ast.instance?.content as Section | undefined),
		...markupChunks(source, ast.fragment),
		...css
	];
}

function chunksOf(source: string, filename: string): Chunk[] {
	if (filename.endsWith('.svelte')) return svelteChunks(source, filename);
	if (filename.endsWith('.css')) return cssValues(source, 0);
	return scriptStrings(source, 0);
}

function literalsIn(chunk: Chunk): { offset: number; literal: string }[] {
	const patterns = chunk.css ? [COLOUR_LITERAL, NAMED_COLOUR] : [COLOUR_LITERAL];
	return patterns.flatMap((pattern) =>
		[...chunk.text.matchAll(pattern)].map((m) => ({ offset: chunk.start + m.index, literal: m[0] }))
	);
}

export function findColorLiterals(source: string, filename: string): Violation[] {
	const lineOf = (offset: number) => source.slice(0, offset).split('\n').length;
	return chunksOf(source, filename)
		.flatMap(literalsIn)
		.sort((a, b) => a.offset - b.offset)
		.map(({ offset, literal }) => ({
			line: lineOf(offset),
			message: `colour literal "${literal}": use a colour token, var(--…)`
		}));
}

function main(root: string): number {
	const files = globSync('src/**/*.{svelte,css,ts}', { cwd: root }).filter(isCheckedFile);
	let count = 0;
	for (const file of files.sort()) {
		const source = readFileSync(path.join(root, file), 'utf8');
		for (const v of findColorLiterals(source, file)) {
			console.error(`${file}:${v.line}: ${v.message}`);
			count++;
		}
	}
	if (count > 0) {
		console.error(`check:colors: ${count} colour literal(s) outside the token files`);
		return 1;
	}
	console.log(`check:colors ok: ${files.length} files`);
	return 0;
}

if (import.meta.main) {
	process.exitCode = main(path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '..')));
}
