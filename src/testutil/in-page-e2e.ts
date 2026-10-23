import type { Page } from '@playwright/test';

// page.evaluate and page.addInitScript serialise one function without its
// closure, so longer in-page code would have to be one long function. These
// run `entry` with `helpers` (plain function declarations, no imports or
// closures) declared beside it, so the in-page code can be short named
// functions.

type InPageFunction = (...args: never[]) => unknown;

function sourceOf<Arg>(entry: (arg: Arg) => unknown, helpers: InPageFunction[], arg: Arg): string {
	const declarations = helpers.map(String).join('\n');
	return `((arg) => {\n${declarations}\nreturn (${String(entry)})(arg);\n})(${JSON.stringify(arg)})`;
}

export function evaluateWith<Arg, Result>(
	page: Page,
	entry: (arg: Arg) => Result,
	helpers: InPageFunction[],
	arg: Arg
): Promise<Awaited<Result>> {
	return page.evaluate(sourceOf(entry, helpers, arg)) as Promise<Awaited<Result>>;
}

// The same, run in every document the page loads from now on.
export async function addInitScriptWith<Arg>(
	page: Page,
	entry: (arg: Arg) => unknown,
	helpers: InPageFunction[],
	arg: Arg
): Promise<void> {
	await page.addInitScript({ content: sourceOf(entry, helpers, arg) });
}
