import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { repoFile } from '../../testutil/load-export';

// FE-4 PR 2 review (root CLAUDE.md, "No duplication of knowledge"): the home
// tab's URL param lives in one place, #lib/ui/home-tab.ts. The head links
// (the only indexable query is ?tab=popular on the home page) take the param
// name and the indexable tab from there instead of their own copies.

const source = () => readFileSync(repoFile('src/lib/i18n/head-links.ts'), 'utf8');

describe('head-links.ts and the home tab param', () => {
	it('imports from #lib/ui/home-tab.ts', () => {
		expect(source(), 'want an import from #lib/ui/home-tab.ts').toMatch(
			/from\s+'(#lib\/ui|\.\.\/ui)\/home-tab\.ts'/
		);
	});

	it("has no string literal 'tab' or 'popular' of its own", () => {
		const literals = source().match(/(['"`])(tab|popular)\1/g) ?? [];
		expect(literals, `got ${JSON.stringify(literals)}, want them from home-tab.ts`).toEqual([]);
	});
});
