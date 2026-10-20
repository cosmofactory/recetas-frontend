import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Component } from 'svelte';
import type { components } from '#lib/api/schema.d.ts';
import '#lib/styles/tokens.css';

// FE-2 media: <Photo> renders one photo role (stack.md X3) as a responsive
// <picture> (AVIF, WebP, JPEG fallback) built from the API key prefix and the
// media base URL. The base URL is a prop, so the component stays
// presentational and never reads env itself. Without a prefix or a base URL
// it renders the design's striped placeholder ("replace them with real
// images at the same size and radius"), using the `--placeholder` token.
// The caller sizes the box: the design gives fixed rendered heights with
// fluid widths (e.g. dish card 96px, dish hero 180px on mobile), so both the
// picture and the placeholder fill their container and never force an aspect
// ratio; the <img> crops with object-fit: cover (X3). The <img> still carries
// the role's intrinsic width/height as a layout-shift hint. `priority` marks
// the above-the-fold photo (e.g. the recipe hero): eager, high fetch priority.
//
// A prefix the contract forbids renders the placeholder; it is logged on the
// server only (Photo.ssr.spec.ts), never in the browser console.
//
// Accessibility (WCAG 1.1.1): a placeholder with a meaningful alt keeps it as
// role="img" + aria-label, so the content isn't lost; with alt="" it is
// decorative and hidden from assistive tech, like <img alt="">.

type Photos = components['schemas']['Photos'];
type Role = keyof Photos;
type PhotoProps = {
	photos: Photos | null;
	role: Role;
	sizes: string;
	alt: string;
	baseUrl: string | undefined;
	priority?: boolean;
	// FE-3: a CSS length or token var; without them the caller sizes the box.
	height?: string;
	radius?: string;
};

// `.invalid` never resolves (RFC 2606), so no image request leaves the box.
const BASE = 'https://media.invalid';
const ALT = 'Tortilla de patatas, Betanzos-style runny';
const SIZES = '(min-width: 860px) 33vw, 100vw';
const PLACEHOLDER_A = 'rgb(228, 216, 191)';
const PLACEHOLDER_B = 'rgb(239, 230, 210)';

const PHOTOS: Photos = {
	thumb: 'dishes/tortilla/gal/thumb-3f9a1c2b',
	card: 'dishes/tortilla/gal/card-3f9a1c2b',
	hero: 'dishes/tortilla/gal/hero-3f9a1c2b'
};

type Box = { width: number; height: number };

// Rendered sizes from the mobile README (region row thumb, dish card, dish
// hero), deliberately not at the role's crop aspect.
const ROLES: { role: Role; widths: [number, number]; intrinsic: Box; box: Box }[] = [
	{
		role: 'thumb',
		widths: [128, 256],
		intrinsic: { width: 128, height: 128 },
		box: { width: 52, height: 52 }
	},
	{
		role: 'card',
		widths: [480, 960],
		intrinsic: { width: 480, height: 320 },
		box: { width: 300, height: 96 }
	},
	{
		role: 'hero',
		widths: [800, 1600],
		intrinsic: { width: 800, height: 450 },
		box: { width: 390, height: 180 }
	}
];
const DEFAULT_BOX: Box = ROLES[1].box;

const modules = import.meta.glob<{ default: Component<PhotoProps> }>('./Photo.svelte');

async function loadPhoto(): Promise<Component<PhotoProps>> {
	const load = modules['./Photo.svelte'];
	expect(load, 'src/lib/components/Photo.svelte must exist').toBeDefined();
	return (await load()).default;
}

const boxes: HTMLElement[] = [];
afterEach(() => {
	boxes.splice(0).forEach((box) => box.remove());
	vi.restoreAllMocks();
});

function fixedBox({ width, height }: Box): HTMLElement {
	const box = document.createElement('div');
	box.style.width = `${width}px`;
	box.style.height = `${height}px`;
	document.body.append(box);
	boxes.push(box);
	return box;
}

async function renderPhoto(props: Partial<PhotoProps> = {}, box = DEFAULT_BOX) {
	const Photo = await loadPhoto();
	const target = fixedBox(box);
	const all: PhotoProps = { photos: PHOTOS, role: 'card', sizes: SIZES, alt: ALT, baseUrl: BASE };
	await render(Photo, { target, props: { ...all, ...props } });
	return target;
}

function srcset(prefix: string, widths: number[], ext: string): string {
	return widths.map((w) => `${BASE}/${prefix}-${w}w.${ext} ${w}w`).join(', ');
}

function onlyChild(box: HTMLElement): HTMLElement {
	expect(box.children.length, `got ${box.children.length} root elements, want 1`).toBe(1);
	return box.firstElementChild as HTMLElement;
}

function expectFillsBox(el: Element, want: Box) {
	const { width, height } = el.getBoundingClientRect();
	expect({ width, height }, `got ${el.tagName} ${width}x${height}`).toEqual(want);
}

function expectNoForcedAspect(root: HTMLElement) {
	expect(root.style.aspectRatio, 'got an inline aspect-ratio on the root').toBe('');
	const computed = getComputedStyle(root).aspectRatio;
	expect(computed, `got root aspect-ratio ${computed}, want auto`).toBe('auto');
}

describe('Photo with a prefix and a base URL', () => {
	for (const { role, widths } of ROLES) {
		it(`renders a <picture> with AVIF then WebP sources for ${role}`, async () => {
			const picture = onlyChild(await renderPhoto({ role }));
			expect(picture.tagName).toBe('PICTURE');
			const sources = [...picture.querySelectorAll('source')];
			expect(sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp']);
			expect(sources.map((s) => s.srcset)).toEqual([
				srcset(PHOTOS[role]!, widths, 'avif'),
				srcset(PHOTOS[role]!, widths, 'webp')
			]);
			expect(sources.map((s) => s.sizes)).toEqual([SIZES, SIZES]);
		});
	}

	it('renders the JPEG fallback <img> with srcset, sizes, alt and lazy async loading', async () => {
		const img = (await renderPhoto({ role: 'hero' })).querySelector('picture > img');
		expect(img, 'got no <picture> > <img>').not.toBeNull();
		const want = {
			src: `${BASE}/${PHOTOS.hero}-800w.jpg`,
			srcset: srcset(PHOTOS.hero!, [800, 1600], 'jpg'),
			sizes: SIZES,
			alt: ALT,
			loading: 'lazy',
			decoding: 'async'
		};
		const got = Object.fromEntries(Object.keys(want).map((k) => [k, img!.getAttribute(k)]));
		expect(got).toEqual(want);
	});

	it('has no fetchpriority by default', async () => {
		const img = (await renderPhoto()).querySelector('img');
		expect(img?.hasAttribute('fetchpriority'), 'want no fetchpriority').toBe(false);
	});

	it('loads eagerly with fetchpriority="high" when priority is set', async () => {
		const img = (await renderPhoto({ priority: true })).querySelector('img');
		const got = [img?.getAttribute('loading'), img?.getAttribute('fetchpriority')];
		expect(got, `got loading/fetchpriority ${got.join('/')}`).toEqual(['eager', 'high']);
	});

	it('stays lazy when priority is false', async () => {
		const img = (await renderPhoto({ priority: false })).querySelector('img');
		expect(img?.getAttribute('loading')).toBe('lazy');
		expect(img?.hasAttribute('fetchpriority'), 'want no fetchpriority').toBe(false);
	});

	it('keeps an empty alt as alt="" (decorative), never dropping the attribute', async () => {
		const img = (await renderPhoto({ alt: '' })).querySelector('img');
		expect(img?.getAttribute('alt'), 'got no alt attribute, want ""').toBe('');
	});

	for (const { role, intrinsic } of ROLES) {
		const { width, height } = intrinsic;
		it(`sets width=${width} height=${height} on the ${role} <img> as a layout hint`, async () => {
			const img = (await renderPhoto({ role })).querySelector('img')!;
			const got = [img.getAttribute('width'), img.getAttribute('height')];
			expect(got).toEqual([`${width}`, `${height}`]);
		});
	}

	for (const { role, box } of ROLES) {
		it(`fills a ${box.width}x${box.height} ${role} box and crops with object-fit: cover`, async () => {
			const container = await renderPhoto({ role }, box);
			const picture = onlyChild(container);
			const img = picture.querySelector('img')!;
			expectFillsBox(picture, box);
			expectFillsBox(img, box);
			expectNoForcedAspect(picture);
			expect(img.style.aspectRatio, 'got an inline aspect-ratio on the img').toBe('');
			expect(getComputedStyle(img).objectFit).toBe('cover');
		});
	}
});

describe('Photo placeholder', () => {
	const missing: { name: string; props: Partial<PhotoProps> }[] = [
		{ name: 'photos is null', props: { photos: null } },
		{ name: 'the role has no prefix', props: { photos: { ...PHOTOS, card: null } } },
		{ name: 'no media base URL is configured', props: { baseUrl: undefined } },
		{ name: 'the media base URL is empty', props: { baseUrl: '' } }
	];
	for (const { name, props } of missing) {
		it(`renders the striped placeholder and no image when ${name}`, async () => {
			const box = await renderPhoto(props);
			expect(box.querySelector('picture, img, source'), 'got an image element').toBeNull();
			const background = getComputedStyle(onlyChild(box)).backgroundImage;
			expect(background).toContain('repeating-linear-gradient(45deg');
			expect(background).toContain(PLACEHOLDER_A);
			expect(background).toContain(PLACEHOLDER_B);
		});
	}

	it('paints exactly the --placeholder token', async () => {
		const placeholder = onlyChild(await renderPhoto({ photos: null }));
		const probe = document.createElement('div');
		probe.style.backgroundImage = 'var(--placeholder)';
		fixedBox(DEFAULT_BOX).append(probe);
		const want = getComputedStyle(probe).backgroundImage;
		expect(getComputedStyle(placeholder).backgroundImage).toBe(want);
	});

	for (const { role, box } of ROLES) {
		it(`fills a ${box.width}x${box.height} ${role} box without forcing an aspect`, async () => {
			const placeholder = onlyChild(await renderPhoto({ role, photos: null }, box));
			expectFillsBox(placeholder, box);
			expectNoForcedAspect(placeholder);
		});
	}

	it('exposes a meaningful alt as role="img" with that accessible name', async () => {
		const placeholder = onlyChild(await renderPhoto({ photos: null }));
		expect(placeholder.getAttribute('role')).toBe('img');
		expect(placeholder.getAttribute('aria-label')).toBe(ALT);
		expect(placeholder.hasAttribute('aria-hidden'), 'want no aria-hidden').toBe(false);
	});

	it('is hidden from assistive tech when alt is empty (decorative)', async () => {
		const placeholder = onlyChild(await renderPhoto({ photos: null, alt: '' }));
		expect(placeholder.getAttribute('aria-hidden')).toBe('true');
		expect(placeholder.hasAttribute('role'), 'want no role').toBe(false);
		expect(placeholder.hasAttribute('aria-label'), 'want no aria-label').toBe(false);
	});

	it('renders the placeholder for a forbidden prefix, logging nothing in the browser', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const bad = { ...PHOTOS, card: 'https://evil.example/card-3f9a1c2b' };
		const box = await renderPhoto({ photos: bad });
		expect(box.querySelector('picture, img, source'), 'got an image element').toBeNull();
		const placeholder = onlyChild(box);
		expect(getComputedStyle(placeholder).backgroundImage).toContain('repeating-linear-gradient');
		expect(placeholder.getAttribute('aria-label')).toBe(ALT);
		expect(consoleError, 'want no console.error in the browser').not.toHaveBeenCalled();
	});
});

// FE-3: <Photo> takes the design's fixed height and radius as props, so a
// card or hero needs no wrapper to size it: "Photo: fixed height and radius
// from props ... explicit dimensions so the layout doesn't shift" (stage
// FE-3). The width stays fluid (100% of the container). The box has its
// final size before any image arrives (the `.invalid` origin never answers),
// and the image is clipped to the radius.
describe('Photo height and radius props', () => {
	const WIDTH = 300;

	function fluidBox(): HTMLElement {
		const box = document.createElement('div');
		box.style.width = `${WIDTH}px`;
		document.body.append(box);
		boxes.push(box);
		return box;
	}

	async function renderSized(props: Partial<PhotoProps>) {
		const Photo = await loadPhoto();
		const target = fluidBox();
		const all: PhotoProps = { photos: PHOTOS, role: 'card', sizes: SIZES, alt: ALT, baseUrl: BASE };
		await render(Photo, { target, props: { ...all, ...props } });
		return onlyChild(target);
	}

	// Mobile README: dish card "Photo: height 96px, radius 11px"; dish hero
	// "hero photo (height 180px, radius 16px)".
	const sized: { name: string; props: Partial<PhotoProps>; height: number; radius: string }[] = [
		{
			name: 'a dish card photo',
			props: { height: '96px', radius: '11px' },
			height: 96,
			radius: '11px'
		},
		{
			name: 'a dish hero photo',
			props: { role: 'hero', height: '180px', radius: 'var(--radius-card)' },
			height: 180,
			radius: '16px'
		},
		{
			name: 'a missing photo (placeholder)',
			props: { photos: null, height: '96px', radius: '11px' },
			height: 96,
			radius: '11px'
		}
	];
	for (const { name, props, height, radius } of sized) {
		it(`sizes ${name} to ${WIDTH}x${height} with radius ${radius} before any image loads`, async () => {
			const root = await renderSized(props);
			expectFillsBox(root, { width: WIDTH, height });
			expect(getComputedStyle(root).borderTopLeftRadius).toBe(radius);
			expectNoForcedAspect(root);
		});
	}

	it('clips the image to the radius', async () => {
		const root = await renderSized({ height: '96px', radius: '11px' });
		const img = root.querySelector('img')!;
		expectFillsBox(img, { width: WIDTH, height: 96 });
		const clipped =
			getComputedStyle(root).overflow === 'hidden' ||
			getComputedStyle(img).borderTopLeftRadius === '11px';
		expect(clipped, 'got an image that overflows the rounded corners').toBe(true);
	});

	it('accepts a token var as the height', async () => {
		const root = await renderSized({ height: 'var(--test-photo-height)' });
		root.parentElement!.style.setProperty('--test-photo-height', '130px');
		expectFillsBox(root, { width: WIDTH, height: 130 });
	});

	it('keeps the object-fit: cover crop when sized by props', async () => {
		const img = (await renderSized({ height: '96px' })).querySelector('img')!;
		expect(getComputedStyle(img).objectFit).toBe('cover');
	});
});
