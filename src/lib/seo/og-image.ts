import { jpegUrls, largestJpegUrl } from '#lib/media.ts';

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
	const options = { baseUrl: mediaBaseUrl, prefix: heroPrefix, role: 'hero' } as const;
	return orNull(() => largestJpegUrl(options)) ?? fallbackUrl(origin);
}

// Every hero width as a JPEG (the JSON-LD `image`), else [the same fallback
// as og:image]: Google requires an image for a Recipe rich result.
export function heroImageUrls({ origin, mediaBaseUrl, heroPrefix = null }: OgImageInput): string[] {
	const options = { baseUrl: mediaBaseUrl, prefix: heroPrefix, role: 'hero' } as const;
	return orNull(() => jpegUrls(options)) ?? [fallbackUrl(origin)];
}

const fallbackUrl = (origin: string) => `${origin}${OG_FALLBACK_IMAGE_PATH}`;

function orNull<T>(build: () => T | null): T | null {
	try {
		return build();
	} catch {
		return null;
	}
}
