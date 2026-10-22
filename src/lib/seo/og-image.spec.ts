import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../../testutil/load-export';

// FE-8 PR 1 (stage FE-8 -> SEO: "an OG image from the hero photo or a static
// fallback"). Decisions pinned here:
// - `ogImageUrl({ origin, mediaBaseUrl, heroPrefix })` in #lib/seo/og-image.ts
//   is the one place the og:image URL is chosen.
// - With a media origin and a hero prefix it is the hero's largest JPEG on
//   the media origin (`<MEDIA_BASE_URL>/<prefix>-1600w.jpg`, the `hero` role's
//   top width in #lib/media.ts): JPEG because not every link-preview crawler
//   reads AVIF/WebP, the largest width because summary_large_image cards
//   are shown wide (16:9, 1600x900).
// - Otherwise (no prefix, no MEDIA_BASE_URL, or a prefix #lib/media.ts
//   rejects) it is the app's static fallback, OG_FALLBACK_IMAGE_PATH
//   ('/og-default.png', served from static/), made absolute on PUBLIC_ORIGIN.
//   A bad prefix never throws: a page's head must still render.
// - static/og-default.png is a 1200x630 PNG (the size Open Graph and
//   Twitter's large card recommend).

type OgImageInput = {
	origin: string;
	mediaBaseUrl: string | undefined;
	heroPrefix: string | null;
};
type OgImageUrl = (input: OgImageInput) => string;

const MODULE = 'src/lib/seo/og-image.ts';
const ORIGIN = 'https://demo.asadorov.es';
const MEDIA = 'https://d1abc.cloudfront.net/media';
const HERO = 'dishes/tortilla/gal/hero-3f9a1c2b';
const FALLBACK = '/og-default.png';
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const ogImageUrl = () => loadExport<OgImageUrl>(MODULE, 'ogImageUrl');

describe('ogImageUrl', () => {
	const cases: { name: string; input: OgImageInput; want: string }[] = [
		{
			name: 'a hero photo on the media origin is its largest JPEG',
			input: { origin: ORIGIN, mediaBaseUrl: MEDIA, heroPrefix: HERO },
			want: `${MEDIA}/${HERO}-1600w.jpg`
		},
		{
			name: 'a media base with a trailing slash gives no double slash',
			input: { origin: ORIGIN, mediaBaseUrl: `${MEDIA}/`, heroPrefix: HERO },
			want: `${MEDIA}/${HERO}-1600w.jpg`
		},
		{
			name: 'no hero photo falls back to the static image on PUBLIC_ORIGIN',
			input: { origin: ORIGIN, mediaBaseUrl: MEDIA, heroPrefix: null },
			want: `${ORIGIN}${FALLBACK}`
		},
		{
			name: 'no media origin falls back to the static image',
			input: { origin: ORIGIN, mediaBaseUrl: undefined, heroPrefix: HERO },
			want: `${ORIGIN}${FALLBACK}`
		},
		{
			name: 'a prefix media.ts rejects falls back instead of throwing',
			input: { origin: ORIGIN, mediaBaseUrl: MEDIA, heroPrefix: '../../evil.example/x' },
			want: `${ORIGIN}${FALLBACK}`
		},
		{
			name: 'the fallback follows the given origin',
			input: { origin: 'http://127.0.0.1:4173', mediaBaseUrl: undefined, heroPrefix: null },
			want: `http://127.0.0.1:4173${FALLBACK}`
		}
	];
	for (const { name, input, want } of cases) {
		it(name, async () => {
			const got = (await ogImageUrl())(input);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	it('exports the fallback path', async () => {
		const path = await loadExport<string>(MODULE, 'OG_FALLBACK_IMAGE_PATH');
		expect(path, `got ${path}, want ${FALLBACK}`).toBe(FALLBACK);
	});
});

// PNG: 8-byte signature, then the IHDR chunk with width and height (big endian).
const PNG_SIGNATURE = '89504e470d0a1a0a';

describe('static/og-default.png', () => {
	const file = repoFile(`static${FALLBACK}`);

	it('exists', () => {
		expect(existsSync(file), `want ${file}`).toBe(true);
	});

	it(`is a ${OG_WIDTH}x${OG_HEIGHT} PNG`, () => {
		expect(existsSync(file), `want ${file}`).toBe(true);
		const png = readFileSync(file);
		expect(png.subarray(0, 8).toString('hex'), 'want a PNG signature').toBe(PNG_SIGNATURE);
		const size = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
		expect(size).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
	});
});
