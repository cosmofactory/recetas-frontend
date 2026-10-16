import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

const noStorage = 'No client-side storage (stack.md X6).';
const restrictedGlobals = ['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
	name,
	message: noStorage
}));
const restrictedProperties = [
	{
		object: 'document',
		property: 'cookie',
		message: 'Cookies are set server-side only (stack.md X6).'
	},
	...['window', 'globalThis'].flatMap((object) =>
		['localStorage', 'sessionStorage'].map((property) => ({ object, property, message: noStorage }))
	)
];

// FE-2: the Go API is reached only from $lib/server (loaders call it through
// the catalog), never from the browser or ad hoc. Kit already refuses to
// bundle $lib/server for the client; this keeps the API client and raw
// fetch calls from appearing anywhere else. Server routes use event.fetch.
const noBackendFetch =
	'Load data in +page.server.ts via $lib/server/catalog.ts (FE-2, stack.md X4).';

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// X6: the only cookie is `lang`, set server-side by /set-lang; no
		// client-side storage at all. Clean-code limits: root CLAUDE.md.
		rules: {
			'max-lines-per-function': [
				'error',
				{ max: 30, skipBlankLines: true, skipComments: true, IIFEs: true }
			],
			'max-params': ['error', 4],
			'max-depth': ['error', 2],
			// Internal links go through localizedHref(), enforced by
			// `pnpm check:strings`; the app has no paths.base to resolve().
			'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }],
			'no-restricted-globals': ['error', ...restrictedGlobals],
			'no-restricted-properties': ['error', ...restrictedProperties]
		}
	},
	{
		files: ['src/**/*.{js,ts,svelte}'],
		ignores: ['src/lib/server/**', 'src/testutil/**', '**/*.spec.ts', '**/*.e2e.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ paths: [{ name: 'openapi-fetch', message: noBackendFetch }] }
			],
			'no-restricted-globals': [
				'error',
				...restrictedGlobals,
				{ name: 'fetch', message: noBackendFetch }
			],
			'no-restricted-properties': [
				'error',
				...restrictedProperties,
				...['window', 'globalThis', 'self'].map((object) => ({
					object,
					property: 'fetch',
					message: noBackendFetch
				}))
			]
		}
	},
	{
		// Test bodies hold long case tables and describe blocks; reviewers
		// check their logic.
		files: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e.ts', 'playwright.config.ts'],
		rules: { 'max-lines-per-function': 'off' }
	}
);
