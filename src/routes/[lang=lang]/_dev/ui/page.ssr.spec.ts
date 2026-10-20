import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadExport, repoFile } from '../../../../testutil/load-export';

// The gallery's <title>, as Paraglide renders it in en (the base locale).
const TITLE = (
	JSON.parse(readFileSync(repoFile('messages/en.json'), 'utf8')) as Record<string, string>
).devUi_title;

// FE-3 review: the gallery must not ship in a production bundle. The load
// already answers 404 outside dev (page.server.spec.ts); the page itself also
// renders its body only under `dev` from $app/env (a build-time constant),
// so Vite drops the gallery markup and its component imports from the build.

type PageData = { dishes: unknown[]; regions: unknown[]; mediaBaseUrl: string | undefined };
const PAGE = 'src/routes/[lang=lang]/_dev/ui/+page.svelte';
const DATA: PageData = { dishes: [], regions: [], mediaBaseUrl: undefined };

async function renderWithDev(dev: boolean): Promise<{ head: string; body: string }> {
	vi.resetModules();
	vi.doMock('$app/env', () => ({ dev, building: false, browser: false }));
	vi.doMock('$app/state', () => ({
		page: { params: { lang: 'en' }, url: new URL('http://localhost/en/_dev/ui'), error: null }
	}));
	const Page = await loadExport<Component<{ data: PageData }>>(PAGE, 'default');
	// After resetModules, so the renderer and the page share one Svelte runtime.
	const { render } = await import('svelte/server');
	return render(Page, { props: { data: DATA } });
}

// Svelte's hydration markers are comments; they carry no content.
function visible(html: string): string {
	return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

afterEach(() => {
	vi.doUnmock('$app/env');
	vi.doUnmock('$app/state');
});

// Each test re-imports the page after resetModules, so the first compiles the
// whole gallery and every component it shows from cold; under a full
// parallel run (browser specs included) that alone can pass Vitest's 5s
// default.
const COLD_COMPILE_TIMEOUT_MS = 30_000;

describe('_dev/ui gallery page', { timeout: COLD_COMPILE_TIMEOUT_MS }, () => {
	it('renders an empty body outside vite dev', async () => {
		const body = visible((await renderWithDev(false)).body);
		expect(body, `got gallery markup outside dev: ${body.slice(0, 200)}`).toBe('');
	});

	it('renders the gallery under vite dev', async () => {
		const { body } = await renderWithDev(true);
		expect(body, 'want the gallery <main> in dev').toContain('<main');
	});

	it('puts the devUi_title message in <title> under vite dev', async () => {
		const { head } = await renderWithDev(true);
		expect(head, `got head ${head}`).toContain(`<title>${TITLE}</title>`);
	});

	it('renders no <title> outside vite dev', async () => {
		const { head } = await renderWithDev(false);
		expect(head, `got head ${head}`).not.toMatch(/<title>/);
	});
});
