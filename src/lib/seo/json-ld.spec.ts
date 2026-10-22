import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-8 PR 2: `serializeJsonLd(data)` in #lib/seo/json-ld.ts is the one way
// JSON-LD becomes the text of a <script type="application/ld+json">. The
// text is raw (entities aren't decoded inside <script>), so it must not be
// HTML-escaped; instead every `<` is written as the JSON escape \u003c, so
// no content (a recipe step, a translated name) can close the script with
// `</script>` or open a comment with `<!--`. The output is still JSON that
// parses back to the same value.

type Serialize = (data: unknown) => string;

const MODULE = 'src/lib/seo/json-ld.ts';
const serialize = () => loadExport<Serialize>(MODULE, 'serializeJsonLd');

const HOSTILE = {
	'@context': 'https://schema.org',
	'@type': 'Recipe',
	name: 'Tortilla </script><script>alert(1)</script>',
	description: 'Fry <!-- gently --> & "serve" it’s hot — жидкая <b>',
	recipeInstructions: [{ '@type': 'HowToStep', text: '</SCRIPT >' }]
};

describe('serializeJsonLd', () => {
	it('round-trips: the output parses back to the same value', async () => {
		const text = (await serialize())(HOSTILE);
		expect(JSON.parse(text)).toEqual(HOSTILE);
	});

	it('writes no "<" at all (it becomes \\u003c)', async () => {
		const text = (await serialize())(HOSTILE);
		expect(text, `got ${text}`).not.toContain('<');
		expect(text).toContain('\\u003c/script>');
	});

	it('cannot close the script or open a comment, in any case', async () => {
		const text = (await serialize())(HOSTILE);
		expect(text).not.toMatch(/<\/script/i);
		expect(text).not.toContain('<!--');
	});

	it('does not HTML-escape (& and quotes stay JSON, not entities)', async () => {
		const text = (await serialize())({ name: 'Mar & montaña' });
		expect(text, `got ${text}`).not.toContain('&amp;');
		expect(JSON.parse(text)).toEqual({ name: 'Mar & montaña' });
	});

	it('keeps an array of documents an array', async () => {
		const docs = [{ '@type': 'BreadcrumbList' }, { '@type': 'ItemList' }];
		expect(JSON.parse((await serialize())(docs))).toEqual(docs);
	});
});
