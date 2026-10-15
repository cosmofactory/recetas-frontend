// FE-1: user-visible text in .svelte markup must come from the i18n messages
// (m.*), and internal links from localizedHref() / setLangHref(). Fails on
// literal text (static or as a string/template literal expression, including
// ternary and ??/|| branches), literal user-visible attributes, literal
// component props and raw root-relative hrefs. Call arguments are not
// checked. The logo "Asadorov" is the only allowed literal (README ->
// Localization rules).
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';

export type Violation = { line: number; message: string };

const ALLOWED_LITERALS = new Set(['Asadorov']);
const VISIBLE_ATTRIBUTES = new Set([
	'alt',
	'aria-label',
	'aria-description',
	'placeholder',
	'title'
]);
// Component props that never carry copy.
const NON_COPY_PROPS = new Set(['class', 'id', 'variant', 'size', 'as', 'type', 'role']);
const DATA_PROP = /^data-/;
// Separators and arrows are not copy; words and numbers are.
const HAS_WORDS = /[\p{L}\p{N}]/u;

type TemplateNode = {
	type?: string;
	start: number;
	name?: string;
	data?: string;
	value?: unknown;
	expression?: Expression;
	attributes?: TemplateNode[];
};
type Expression = {
	type: string;
	value?: unknown;
	quasis?: { value: { cooked: string | null } }[];
	consequent?: Expression;
	alternate?: Expression;
	left?: Expression;
	right?: Expression;
};
type Report = (node: TemplateNode, message: string) => void;

function isCopy(text: string): boolean {
	return HAS_WORDS.test(text) && !ALLOWED_LITERALS.has(text);
}

// The branches an expression's value can come from: a ? b : c -> b, c;
// a ?? b and a || b -> a, b. Calls and identifiers are leaves.
function branches(expr: Expression): Expression[] {
	if (expr.type === 'ConditionalExpression') return [expr.consequent!, expr.alternate!];
	if (expr.type === 'LogicalExpression') return [expr.left!, expr.right!];
	return [expr];
}

// The literal strings an expression can produce; `leading` keeps only the
// text a template literal starts with (what an href begins with).
function literalTexts(expr: Expression, leading = false): string[] {
	if (expr.type === 'ConditionalExpression' || expr.type === 'LogicalExpression') {
		return branches(expr).flatMap((branch) => literalTexts(branch, leading));
	}
	if (expr.type === 'Literal') return typeof expr.value === 'string' ? [expr.value] : [];
	if (expr.type !== 'TemplateLiteral') return [];
	const quasis = (expr.quasis ?? []).map((q) => q.value.cooked ?? '');
	return [leading ? (quasis[0] ?? '') : quasis.join('')];
}

// An attribute's value as parts: "a {b} c" -> [Text, ExpressionTag, Text];
// {b} -> [ExpressionTag]; a bare attribute -> [].
function valueParts(attribute: TemplateNode): TemplateNode[] {
	const value = attribute.value;
	if (Array.isArray(value)) return value as TemplateNode[];
	return value && typeof value === 'object' ? [value as TemplateNode] : [];
}

function partTexts(parts: TemplateNode[]): string[] {
	const staticText = parts
		.filter((p) => p.type === 'Text')
		.map((p) => p.data ?? '')
		.join('');
	const dynamic = parts.flatMap((p) => (p.expression ? literalTexts(p.expression) : []));
	return [staticText, ...dynamic].map((t) => t.trim()).filter(isCopy);
}

function hrefStarts(parts: TemplateNode[]): string[] {
	const [first] = parts;
	if (first?.type === 'Text') return [first.data ?? ''];
	return first?.expression ? literalTexts(first.expression, true) : [];
}

function checkHref(attribute: TemplateNode, report: Report) {
	for (const start of hrefStarts(valueParts(attribute)).filter((t) => t.startsWith('/'))) {
		report(attribute, `raw internal href "${start}": use localizedHref() or setLangHref()`);
	}
}

function isCopyProp(name: string, onComponent: boolean): boolean {
	if (VISIBLE_ATTRIBUTES.has(name)) return true;
	return onComponent && !NON_COPY_PROPS.has(name) && !DATA_PROP.test(name);
}

function checkAttribute(attribute: TemplateNode, onComponent: boolean, report: Report) {
	const name = attribute.name ?? '';
	if (name === 'href') return checkHref(attribute, report);
	if (!isCopyProp(name, onComponent)) return;
	const kind = VISIBLE_ATTRIBUTES.has(name) ? name : `prop ${name}`;
	for (const text of partTexts(valueParts(attribute))) {
		report(attribute, `hard-coded ${kind} "${text}": use a message (m.*)`);
	}
}

function checkElement(node: TemplateNode, report: Report) {
	const onComponent = node.type === 'Component';
	for (const attribute of node.attributes ?? []) {
		if (attribute.type === 'Attribute') checkAttribute(attribute, onComponent, report);
	}
}

function checkText(node: TemplateNode, report: Report) {
	const texts = node.type === 'Text' ? [node.data ?? ''] : literalTexts(node.expression!);
	for (const text of texts.map((t) => t.trim()).filter(isCopy)) {
		report(node, `hard-coded text "${text}": use a message (m.*)`);
	}
}

// Visits every template node. Attributes are judged by checkElement and an
// interpolation by checkText; neither is walked further.
function walk(value: unknown, report: Report) {
	if (Array.isArray(value)) return value.forEach((item) => walk(item, report));
	if (value === null || typeof value !== 'object') return;
	const node = value as TemplateNode;
	if (node.type === 'Text' || node.type === 'ExpressionTag') return checkText(node, report);
	if (Array.isArray(node.attributes)) checkElement(node, report);
	for (const [key, child] of Object.entries(node)) {
		if (key !== 'attributes') walk(child, report);
	}
}

export function findViolations(source: string, filename: string): Violation[] {
	const ast = parse(source, { modern: true, filename });
	const lineOf = (offset: number) => source.slice(0, offset).split('\n').length;
	const violations: Violation[] = [];
	walk(ast.fragment, (node, message) => violations.push({ line: lineOf(node.start), message }));
	return violations;
}

function main(): number {
	const root = path.resolve(import.meta.dirname, '..');
	const files = globSync('src/**/*.svelte', { cwd: root, exclude: ['src/lib/paraglide/**'] });
	let count = 0;
	for (const file of files.sort()) {
		const source = readFileSync(path.join(root, file), 'utf8');
		for (const v of findViolations(source, file)) {
			console.error(`${file}:${v.line}: ${v.message}`);
			count++;
		}
	}
	if (count > 0) {
		console.error(`check:strings: ${count} hard-coded string(s)`);
		return 1;
	}
	console.log(`check:strings ok: ${files.length} components`);
	return 0;
}

if (import.meta.main) {
	process.exitCode = main();
}
