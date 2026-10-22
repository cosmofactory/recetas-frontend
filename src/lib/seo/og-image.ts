import { largestJpegUrl } from '#lib/media.ts';

// Served from static/: a 1200x630 placeholder in the page colour until the
// design team supplies the real image.
export const OG_FALLBACK_IMAGE_PATH = '/og-default.png';

export type OgImageInput = {
	origin: string;
	mediaBaseUrl?: string | undefined;
	heroPrefix?: string | null;
};

// The page's og:image: the hero's largest JPEG on the media origin (not every
// crawler reads AVIF/WebP; large cards are shown wide), else the static
// fallback on PUBLIC_ORIGIN. A prefix media.ts rejects must not break the
// head; the page's <Photo> reports it.
export function ogImageUrl({ origin, mediaBaseUrl, heroPrefix = null }: OgImageInput): string {
	return heroJpeg(mediaBaseUrl, heroPrefix) ?? `${origin}${OG_FALLBACK_IMAGE_PATH}`;
}

function heroJpeg(baseUrl: string | undefined, prefix: string | null): string | null {
	try {
		return largestJpegUrl({ baseUrl, prefix, role: 'hero' });
	} catch {
		return null;
	}
}
