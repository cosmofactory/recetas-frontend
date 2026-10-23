import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit, type Config as KitConfig } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

// Vite 8's baseline-widely-available targets with Safari/iOS lowered to 16.
const BUILD_TARGETS = ['chrome111', 'edge111', 'firefox114', 'safari16', 'ios16'];
// Fonts and the favicon are always separate files (preloaded, cached), never
// data: URLs, so the CSP's img-src and font-src need no `data:`.
const NEVER_INLINED_ASSET = /\.(woff2?|svg)$/;

// D-FE8-2 (mobile LCP): Rolldown's default split gave the home page ~30
// modulepreloaded chunks, and on a slow phone link each one costs a round
// trip before first paint. Two groups cut that to ~9: every library in one
// `vendor` chunk and the app code shared by two or more routes in one `lib`
// chunk; code only one route uses stays in its node. Kit's client runtime
// stays out of `vendor`: Kit's entry imports it dynamically and finds it by
// that import (the build fails with "Could not find the client runtime
// chunk" otherwise). Client build only; the server build keeps its split.
const KIT_CLIENT_RUNTIME = /@sveltejs[\\/]kit[\\/]src[\\/]runtime[\\/]client[\\/]/;
const APP_SOURCE = /[\\/]src[\\/]/;
const isDependency = (id: string) => id.includes('node_modules');
const MIN_ROUTES_FOR_SHARED_CHUNK = 2;
const CLIENT_CHUNK_GROUPS = {
	groups: [
		{ name: 'vendor', test: (id: string) => isDependency(id) && !KIT_CLIENT_RUNTIME.test(id) },
		{
			name: 'lib',
			test: (id: string) => !isDependency(id) && APP_SOURCE.test(id),
			minShareCount: MIN_ROUTES_FOR_SHARED_CHUNK
		}
	]
};

// Stage FE-8, Small decisions -> CSP; D-FE8-1 (Caddy sets HSTS and the other
// proxy headers). Kit adds a nonce (SSR) or hash (prerendered) for its own
// inline scripts and styles. Style attributes (app.html, map tile colours,
// <Photo> sizing) can't carry a nonce, hence the one relaxation,
// style-src-attr. hooks.server.ts adds the runtime MEDIA_BASE_URL to img-src.
const CSP: KitConfig['csp'] = {
	mode: 'auto',
	directives: {
		'default-src': ['self'],
		'script-src': ['self'],
		'style-src': ['self'],
		'style-src-attr': ['unsafe-inline'],
		'img-src': ['self'],
		'font-src': ['self'],
		'connect-src': ['self'],
		'frame-ancestors': ['none'],
		'base-uri': ['self'],
		'form-action': ['self'],
		'object-src': ['none']
	}
};

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
			csp: CSP,
			// Request, handle and load spans (stack.md B7); they go nowhere until
			// src/instrumentation.server.ts registers a provider (LOGFIRE_TOKEN).
			tracing: { server: true }
		})
	],
	environments: {
		client: { build: { rolldownOptions: { output: { codeSplitting: CLIENT_CHUNK_GROUPS } } } }
	},
	build: {
		// stack.md X10 supports iOS/Safari 16; Vite's default baseline starts at
		// 16.4, and its CSS minifier would then rewrite `min-width` queries
		// into range syntax that Safari 16.0-16.3 ignores.
		target: BUILD_TARGETS,
		cssTarget: BUILD_TARGETS,
		assetsInlineLimit: (filePath) => (NEVER_INLINED_ASSET.test(filePath) ? false : undefined)
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
