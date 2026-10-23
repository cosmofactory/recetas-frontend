import { expect } from 'vitest';
import { startTags, type StartTag } from './html';

// FE-8 PR 3 (stage FE-8 -> Performance: "Preload the hero image on the recipe
// and variations pages. Only above-the-fold images are eager-loaded").
// Decisions pinned by expectHeroPreload:
// - With a hero photo the page's HEAD has exactly one
//   <link rel="preload" as="image">, with fetchpriority="high".
// - It preloads what the <picture> will actually pick: the hero's FIRST
//   <source> (AVIF; browsers take the first type they support), so
//   `type` is that source's type, `imagesrcset` its srcset and
//   `imagesizes` its sizes, byte for byte. A preload of the JPEG fallback
//   would be a second download on every AVIF browser.
// - Without a photo (or without MEDIA_BASE_URL) there is no image preload.

// Attribute names lower-cased (HTML is case-insensitive: imageSrcset ==
// imagesrcset).
function lowerAttrs(tag: StartTag): Record<string, string> {
	return Object.fromEntries(Object.entries(tag.attrs).map(([k, v]) => [k.toLowerCase(), v]));
}

export function imagePreloads(html: string): Record<string, string>[] {
	return startTags(html)
		.filter((t) => t.name === 'link')
		.map(lowerAttrs)
		.filter((a) => a.rel === 'preload' && a.as === 'image');
}

// The first <source> of the hero <picture> (the one whose srcset names the
// hero key).
function heroSource(body: string, heroKey: string): Record<string, string> {
	const sources = startTags(body)
		.filter((t) => t.name === 'source')
		.map(lowerAttrs)
		.filter((a) => (a.srcset ?? '').includes(heroKey));
	expect(sources.length, `got no <source> for ${heroKey}, want the hero picture`).toBeGreaterThan(
		0
	);
	return sources[0];
}

export function expectHeroPreload(page: { head: string; body: string }, heroKey: string) {
	const preloads = imagePreloads(page.head);
	expect(preloads.length, `got ${JSON.stringify(preloads)}, want one image preload`).toBe(1);
	const want = heroSource(page.body, heroKey);
	const [got] = preloads;
	expect(got.type, `got type ${got.type}, want ${want.type}`).toBe(want.type);
	expect(got.imagesrcset, 'want imagesrcset = the hero’s first <source> srcset').toBe(want.srcset);
	expect(got.imagesizes, 'want imagesizes = the hero’s sizes').toBe(want.sizes);
	expect(got.fetchpriority, `got fetchpriority ${got.fetchpriority}, want high`).toBe('high');
}

export function expectNoImagePreload(page: { head: string; body: string }) {
	const found = [...imagePreloads(page.head), ...imagePreloads(page.body)];
	expect(found, `got image preloads ${JSON.stringify(found)}, want none`).toEqual([]);
}
