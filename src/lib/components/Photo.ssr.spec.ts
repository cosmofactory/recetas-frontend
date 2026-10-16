import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import type { components } from '#lib/api/schema.d.ts';
import { loadExport } from '../../testutil/load-export';

// FE-2 media, server side: a prefix the contract forbids is a backend bug,
// so the server render logs it once (naming the prefix, so it can be traced
// to the content) and still draws the placeholder rather than failing the
// page. The browser stays quiet (Photo.svelte.spec.ts).

type Photos = components['schemas']['Photos'];
type PhotoProps = {
	photos: Photos | null;
	role: keyof Photos;
	sizes: string;
	alt: string;
	baseUrl: string | undefined;
};

const BAD = 'https://evil.example/card-3f9a1c2b';
const PROPS: PhotoProps = {
	photos: { thumb: null, card: BAD, hero: null },
	role: 'card',
	sizes: '100vw',
	alt: 'Tortilla de patatas',
	baseUrl: 'https://media.invalid'
};

afterEach(() => vi.restoreAllMocks());

const loadPhoto = () =>
	loadExport<Component<PhotoProps>>('src/lib/components/Photo.svelte', 'default');

function loggedText(calls: unknown[][]): string {
	return calls
		.flat()
		.map((arg) => (arg instanceof Error ? arg.message : String(arg)))
		.join(' ');
}

describe('Photo server render with a forbidden prefix', () => {
	it('logs one error naming the prefix and renders the placeholder, not an image', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { body } = render(await loadPhoto(), { props: PROPS });
		expect(body, 'got an image element in the server HTML').not.toMatch(/<(img|picture|source)\b/);
		expect(body).toContain('aria-label="Tortilla de patatas"');
		expect(consoleError, 'want exactly one console.error').toHaveBeenCalledTimes(1);
		const text = loggedText(consoleError.mock.calls);
		expect(text, `got log ${JSON.stringify(text)}, want it to name ${BAD}`).toContain(BAD);
	});
});
