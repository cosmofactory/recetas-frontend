import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { repoFile } from '../../testutil/load-export';

// FE-3 content vs container (F6). Stage FE-3: "Content components
// (`RegionDetails`, `DishDetails`, `FilterGroups`) live in `src/lib/content/`,
// never import a container, and receive only data and callbacks." ESLint
// enforces it with a no-restricted-imports override for src/lib/content/**:
// whatever the import path spelling, a content module that imports a
// container fails lint. Content may still use the controls (Chip, ...), and
// screens may import containers. The override must keep the FE-2 rule
// (no openapi-fetch outside $lib/server) in force there too.
//
// The fixtures are linted as virtual files with the repo's own config; the
// type-aware parser can't see a file that isn't on disk, so it is switched
// off for them (the import rules don't need types).

const CONTAINERS = ['BottomSheet', 'OverlaySheet', 'StickyPanel', 'Scrim'];
const RULE = 'no-restricted-imports';

let eslint: ESLint | undefined;

function linter(): ESLint {
	eslint ??= new ESLint({
		cwd: repoFile('.'),
		overrideConfig: {
			files: ['**/*.svelte', '**/*.svelte.ts'],
			languageOptions: { parserOptions: { projectService: false } }
		}
	});
	return eslint;
}

function svelteImporting(specifier: string): string {
	return (
		'<script lang="ts">\n' +
		`\timport Imported from '${specifier}';\n` +
		'\tconst used: unknown = Imported;\n' +
		'</script>\n\n<p>{String(used)}</p>\n'
	);
}

function tsImporting(specifier: string): string {
	return `import Imported from '${specifier}';\n\nexport const used: unknown = Imported;\n`;
}

async function restrictedImportMessages(code: string, filePath: string): Promise<string[]> {
	const [result] = await linter().lintText(code, { filePath });
	const fatal = result.messages.filter((message) => message.fatal);
	expect(
		fatal.map((message) => message.message),
		'got a parse error in the fixture'
	).toEqual([]);
	return result.messages
		.filter((message) => message.ruleId === RULE)
		.map((message) => message.message);
}

type Fixture = { file: string; specifier: (name: string) => string; code: typeof tsImporting };

// Every way a content module can spell a container import.
const SPELLINGS: Fixture[] = [
	{
		file: 'src/lib/content/RegionDetails.svelte',
		specifier: (name) => `#lib/components/ui/${name}.svelte`,
		code: svelteImporting
	},
	{
		file: 'src/lib/content/RegionDetails.svelte',
		specifier: (name) => `$lib/components/ui/${name}.svelte`,
		code: svelteImporting
	},
	{
		file: 'src/lib/content/RegionDetails.svelte',
		specifier: (name) => `../components/ui/${name}.svelte`,
		code: svelteImporting
	},
	{
		file: 'src/lib/content/region/DishList.svelte',
		specifier: (name) => `../../components/ui/${name}.svelte`,
		code: svelteImporting
	},
	{
		file: 'src/lib/content/filter-groups.ts',
		specifier: (name) => `#lib/components/ui/${name}.svelte`,
		code: tsImporting
	}
];

describe('content modules may not import a container', () => {
	for (const name of CONTAINERS) {
		for (const { file, specifier, code } of SPELLINGS) {
			it(`fails lint for ${file} importing '${specifier(name)}'`, async () => {
				const messages = await restrictedImportMessages(code(specifier(name)), file);
				expect(messages.length, `want a ${RULE} error, got none`).toBeGreaterThan(0);
			});
		}
	}
});

describe('what stays allowed', () => {
	it('lets a content module import a control (Chip)', async () => {
		const code = svelteImporting('#lib/components/ui/Chip.svelte');
		const messages = await restrictedImportMessages(code, 'src/lib/content/RegionDetails.svelte');
		expect(messages).toEqual([]);
	});

	for (const name of CONTAINERS) {
		it(`lets a screen import ${name}`, async () => {
			const code = svelteImporting(`#lib/components/ui/${name}.svelte`);
			const file = 'src/routes/[lang=lang]/+page.svelte';
			expect(await restrictedImportMessages(code, file)).toEqual([]);
		});
	}
});

describe('the FE-2 import rule in content modules', () => {
	it('still forbids openapi-fetch there', async () => {
		const code = svelteImporting('openapi-fetch');
		const messages = await restrictedImportMessages(code, 'src/lib/content/RegionDetails.svelte');
		expect(messages.length, `want a ${RULE} error for openapi-fetch`).toBeGreaterThan(0);
	});
});
