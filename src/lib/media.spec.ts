import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadExport } from '../testutil/load-export';

// FE-2 media (stack.md X3): the API returns a key prefix per photo role
// (`dishes/tortilla/gal/hero-3f9a1c2b`, or null when there is no photo) and
// the frontend appends `-<w>w.<avif|webp|jpg>` against MEDIA_BASE_URL, using
// the role's width ladder with `w` descriptors; callers pass `sizes`. A null
// prefix or an unset base URL yields null, so the caller shows the striped
// placeholder. A prefix the contract forbids (leading slash, scheme, `..`,
// extension, ...) throws instead of building a URL to somewhere else.
//
// The JPEG fallback `src` is the smaller width: only a browser that ignores
// `srcset` reads it, and for that browser the cheaper file is the safe pick.

type Role = 'thumb' | 'card' | 'hero';
type ImageSet = {
	sources: { type: string; srcset: string }[];
	fallback: { src: string; srcset: string };
};
type ImageSetOptions = { baseUrl: string | undefined; prefix: string | null; role: Role };
type BuildImageSet = (options: ImageSetOptions) => ImageSet | null;
type ParseMediaBaseUrl = (value: string | undefined) => string | undefined;

const MEDIA = 'src/lib/media.ts';
const loadImageSet = () => loadExport<BuildImageSet>(MEDIA, 'imageSet');
const loadRoleWidths = () => loadExport<Record<Role, readonly number[]>>(MEDIA, 'ROLE_WIDTHS');
type SafeImageSetOptions = ImageSetOptions & { report?: (err: unknown) => void };
const loadSafeImageSet = () =>
	loadExport<(options: SafeImageSetOptions) => ImageSet | null>(MEDIA, 'imageSetOrPlaceholder');
const loadParser = () => loadExport<ParseMediaBaseUrl>(MEDIA, 'parseMediaBaseUrl');

const BASE = 'https://media.asadorov.es';
const HERO = 'dishes/tortilla/gal/hero-3f9a1c2b';

function ladder(url: string, widths: readonly number[], ext: string): string {
	return widths.map((w) => `${url}-${w}w.${ext} ${w}w`).join(', ');
}

function expectedSet(url: string, widths: readonly number[]): ImageSet {
	return {
		sources: [
			{ type: 'image/avif', srcset: ladder(url, widths, 'avif') },
			{ type: 'image/webp', srcset: ladder(url, widths, 'webp') }
		],
		fallback: { src: `${url}-${widths[0]}w.jpg`, srcset: ladder(url, widths, 'jpg') }
	};
}

describe('ROLE_WIDTHS', () => {
	it('is the X3 width ladder per role, smallest first', async () => {
		const got = await loadRoleWidths();
		expect(got).toEqual({ thumb: [128, 256], card: [480, 960], hero: [800, 1600] });
	});
});

describe('imageSet', () => {
	const roles: { role: Role; prefix: string; widths: number[] }[] = [
		{ role: 'thumb', prefix: 'dishes/tortilla/thumb-0a1b2c3d', widths: [128, 256] },
		{ role: 'card', prefix: 'dishes/tortilla/gal/card-77aa00ff', widths: [480, 960] },
		{ role: 'hero', prefix: HERO, widths: [800, 1600] }
	];
	for (const { role, prefix, widths } of roles) {
		it(`builds AVIF, WebP and a JPEG fallback at ${widths.join('/')}w for ${role}`, async () => {
			const got = (await loadImageSet())({ baseUrl: BASE, prefix, role });
			expect(got).toEqual(expectedSet(`${BASE}/${prefix}`, widths));
		});
	}

	it('lists AVIF before WebP, so browsers pick the smaller format first', async () => {
		const got = (await loadImageSet())({ baseUrl: BASE, prefix: HERO, role: 'hero' });
		expect(got?.sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp']);
	});

	const bases: { baseUrl: string; want: string }[] = [
		{ baseUrl: 'https://media.asadorov.es', want: 'https://media.asadorov.es' },
		{ baseUrl: 'https://media.asadorov.es/', want: 'https://media.asadorov.es' },
		{ baseUrl: 'https://d1abc.cloudfront.net/media', want: 'https://d1abc.cloudfront.net/media' },
		{ baseUrl: 'https://d1abc.cloudfront.net/media/', want: 'https://d1abc.cloudfront.net/media' }
	];
	for (const { baseUrl, want } of bases) {
		it(`joins base ${JSON.stringify(baseUrl)} and the prefix with exactly one slash`, async () => {
			const got = (await loadImageSet())({ baseUrl, prefix: HERO, role: 'hero' });
			const src = got?.fallback.src;
			expect(src, `got ${src}, want ${want}/${HERO}-800w.jpg`).toBe(`${want}/${HERO}-800w.jpg`);
		});
	}

	it('returns null for a null prefix (no photo), so the caller shows the placeholder', async () => {
		const got = (await loadImageSet())({ baseUrl: BASE, prefix: null, role: 'card' });
		expect(got, `got ${JSON.stringify(got)}, want null`).toBeNull();
	});

	for (const baseUrl of [undefined, '']) {
		it(`returns null when the base URL is ${JSON.stringify(baseUrl)} (media not configured)`, async () => {
			const got = (await loadImageSet())({ baseUrl, prefix: HERO, role: 'hero' });
			expect(got, `got ${JSON.stringify(got)}, want null`).toBeNull();
		});
	}

	const forbidden: { name: string; prefix: string }[] = [
		{ name: 'an empty prefix', prefix: '' },
		{ name: 'a leading slash', prefix: '/dishes/tortilla/hero-3f9a1c2b' },
		{ name: 'an absolute URL', prefix: 'https://evil.example/hero-3f9a1c2b' },
		{ name: 'a protocol-relative URL', prefix: '//evil.example/hero-3f9a1c2b' },
		{ name: 'a scheme', prefix: 'javascript:alert(1)' },
		{ name: 'a .. segment', prefix: 'dishes/../secrets/hero-3f9a1c2b' },
		{ name: 'an encoded .. segment', prefix: 'dishes/%2e%2e/hero-3f9a1c2b' },
		{ name: 'an extension', prefix: 'dishes/tortilla/hero-3f9a1c2b.jpg' },
		{ name: 'a trailing slash', prefix: 'dishes/tortilla/hero-3f9a1c2b/' },
		{ name: 'an empty segment', prefix: 'dishes//tortilla/hero-3f9a1c2b' },
		{ name: 'a backslash', prefix: 'dishes\\tortilla\\hero-3f9a1c2b' },
		{ name: 'a query string', prefix: 'dishes/tortilla/hero-3f9a1c2b?w=1' },
		{ name: 'a fragment', prefix: 'dishes/tortilla/hero-3f9a1c2b#x' },
		{ name: 'whitespace', prefix: 'dishes/tortilla/hero 3f9a1c2b' },
		{ name: 'upper case (keys are ASCII slugs)', prefix: 'dishes/Tortilla/hero-3f9a1c2b' }
	];
	for (const { name, prefix } of forbidden) {
		it(`throws on a prefix with ${name}`, async () => {
			const imageSet = await loadImageSet();
			expect(() => imageSet({ baseUrl: BASE, prefix, role: 'hero' })).toThrow();
		});
	}
});

describe('parseMediaBaseUrl', () => {
	for (const value of [undefined, '']) {
		it(`treats ${JSON.stringify(value)} as unset, so every photo is a placeholder`, async () => {
			const got = (await loadParser())(value);
			expect(got, `got ${got}, want undefined`).toBeUndefined();
		});
	}

	const valid: { value: string; want: string }[] = [
		{ value: 'https://media.asadorov.es', want: 'https://media.asadorov.es' },
		{ value: 'https://media.asadorov.es/', want: 'https://media.asadorov.es' },
		{ value: 'https://d1abc.cloudfront.net/media', want: 'https://d1abc.cloudfront.net/media' },
		{ value: 'https://d1abc.cloudfront.net/media/', want: 'https://d1abc.cloudfront.net/media' }
	];
	for (const { value, want } of valid) {
		it(`accepts ${value} as ${want} (an https origin, optionally with a path)`, async () => {
			const got = (await loadParser())(value);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	const invalid = [
		'media.asadorov.es',
		'http://media.asadorov.es',
		'ftp://media.asadorov.es',
		'https://media.asadorov.es/media?v=1',
		'https://media.asadorov.es/#x',
		'https://user:pass@media.asadorov.es',
		'not a url'
	];
	for (const value of invalid) {
		it(`rejects ${JSON.stringify(value)} with an error naming MEDIA_BASE_URL`, async () => {
			const parse = await loadParser();
			expect(() => parse(value)).toThrow(/MEDIA_BASE_URL/);
		});
	}
});

// For rendering, a contract-violating prefix must not fail the whole page:
// the photo falls back to the placeholder. Logging is the caller's choice
// through `report` (Photo passes one on the server only, so the browser
// console stays quiet); the reported error names the prefix, so it can be
// traced to the content.
describe('imageSetOrPlaceholder', () => {
	const BAD = 'dishes/../secrets/hero-3f9a1c2b';

	afterEach(() => vi.restoreAllMocks());

	function errorText(err: unknown): string {
		return err instanceof Error ? err.message : String(err);
	}

	it('returns null for a forbidden prefix and reports one error naming it', async () => {
		const report = vi.fn();
		const got = (await loadSafeImageSet())({ baseUrl: BASE, prefix: BAD, role: 'hero', report });
		expect(got, `got ${JSON.stringify(got)}, want null`).toBeNull();
		expect(report, 'want exactly one report').toHaveBeenCalledTimes(1);
		const text = errorText(report.mock.calls[0][0]);
		expect(text, `got ${JSON.stringify(text)}, want it to name ${BAD}`).toContain(BAD);
	});

	it('returns null for a forbidden prefix without a reporter, and logs nothing', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const got = (await loadSafeImageSet())({ baseUrl: BASE, prefix: BAD, role: 'hero' });
		expect(got, `got ${JSON.stringify(got)}, want null`).toBeNull();
		expect(consoleError, 'want no console.error without a reporter').not.toHaveBeenCalled();
	});

	it('passes a valid prefix through unchanged, without reporting', async () => {
		const report = vi.fn();
		const got = (await loadSafeImageSet())({ baseUrl: BASE, prefix: HERO, role: 'hero', report });
		expect(got).toEqual(expectedSet(`${BASE}/${HERO}`, [800, 1600]));
		expect(report, 'want no report').not.toHaveBeenCalled();
	});

	const absent: { name: string; options: ImageSetOptions }[] = [
		{ name: 'a null prefix', options: { baseUrl: BASE, prefix: null, role: 'card' } },
		{ name: 'no base URL', options: { baseUrl: undefined, prefix: HERO, role: 'hero' } }
	];
	for (const { name, options } of absent) {
		it(`returns null for ${name} without reporting (not an error)`, async () => {
			const report = vi.fn();
			const got = (await loadSafeImageSet())({ ...options, report });
			expect(got, `got ${JSON.stringify(got)}, want null`).toBeNull();
			expect(report, 'want no report').not.toHaveBeenCalled();
		});
	}
});
