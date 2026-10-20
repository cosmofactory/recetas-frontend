import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
	plugins: [
		// Options live in project.inlang/paraglide.config.ts.
		paraglideVitePlugin({ project: './project.inlang' }),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Request, handle and load spans (stack.md B7); they go nowhere until
			// src/instrumentation.server.ts registers a provider (LOGFIRE_TOKEN).
			tracing: { server: true }
		})
	],
	build: {
		// Fonts are always separate files (preloaded, cached); never data: URLs.
		assetsInlineLimit: (filePath) => (/\.woff2?$/.test(filePath) ? false : undefined)
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					// Pre-bundled once: transforming the compiler's many modules
					// per test file costs seconds under a full parallel run.
					deps: {
						optimizer: {
							ssr: {
								enabled: true,
								// Any other svelte/* subpath a server spec imports (directly or
								// via compiled components) must be listed here too, or it loads
								// a second copy of Svelte internals beside the bundled one.
								include: ['svelte/compiler', 'svelte/server', 'svelte/internal/server', 'svelte']
							}
						}
					}
				}
			}
		]
	}
});
