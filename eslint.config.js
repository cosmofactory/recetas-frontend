import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

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
		// client-side storage at all.
		rules: {
			'no-restricted-globals': [
				'error',
				{ name: 'localStorage', message: 'No client-side storage (stack.md X6).' },
				{ name: 'sessionStorage', message: 'No client-side storage (stack.md X6).' },
				{ name: 'indexedDB', message: 'No client-side storage (stack.md X6).' }
			],
			'no-restricted-properties': [
				'error',
				{
					object: 'document',
					property: 'cookie',
					message: 'Cookies are set server-side only (stack.md X6).'
				},
				{
					object: 'window',
					property: 'localStorage',
					message: 'No client-side storage (stack.md X6).'
				},
				{
					object: 'window',
					property: 'sessionStorage',
					message: 'No client-side storage (stack.md X6).'
				},
				{
					object: 'globalThis',
					property: 'localStorage',
					message: 'No client-side storage (stack.md X6).'
				},
				{
					object: 'globalThis',
					property: 'sessionStorage',
					message: 'No client-side storage (stack.md X6).'
				}
			]
		}
	}
);
