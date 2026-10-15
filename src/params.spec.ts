import { describe, expect, it } from 'vitest';
import { loadExport } from './testutil/load-export';

// FE-1: the `lang` param matcher for src/routes/[lang=lang]/ accepts en|es|ru
// only; any other prefix falls through to a 404. SvelteKit 3 reads matchers
// from src/params.ts (`export const params = defineParams({ lang })`), each a
// Standard Schema, so this tests through `~standard.validate`.

type Result = { value?: unknown; issues?: readonly unknown[] };
type Matcher = { '~standard': { validate: (value: unknown) => Result | Promise<Result> } };

async function validateLang(value: string): Promise<Result> {
	const params = await loadExport<Record<string, Matcher | undefined>>('src/params.ts', 'params');
	expect(params.lang?.['~standard'], 'got no params.lang matcher, want one').toBeDefined();
	return params.lang!['~standard'].validate(value);
}

describe('lang param matcher', () => {
	for (const lang of ['en', 'es', 'ru']) {
		it(`accepts ${lang}`, async () => {
			const got = await validateLang(lang);
			expect(got.issues, `got issues ${JSON.stringify(got.issues)}, want none`).toBeUndefined();
			expect(got.value, `got ${JSON.stringify(got.value)}, want ${lang}`).toBe(lang);
		});
	}

	for (const param of ['fr', 'xx', 'EN', 'Ru', 'en-us', 'dishes', 'set-lang', '']) {
		it(`rejects ${JSON.stringify(param)}`, async () => {
			const got = await validateLang(param);
			expect(got.issues?.length, `got ${JSON.stringify(got)}, want issues`).toBeGreaterThan(0);
		});
	}
});
