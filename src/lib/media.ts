import type { components } from '#lib/api/schema.d.ts';

export type Photos = components['schemas']['Photos'];
export type PhotoRole = keyof Photos;

export type ImageSet = {
	sources: { type: string; srcset: string }[];
	fallback: { src: string; srcset: string };
};

export type ImageSetOptions = {
	baseUrl: string | undefined;
	prefix: string | null;
	role: PhotoRole;
};

// stack.md X3: each role is pre-generated at these widths, smallest first.
export const ROLE_WIDTHS: Record<PhotoRole, readonly [number, number]> = {
	thumb: [128, 256],
	card: [480, 960],
	hero: [800, 1600]
};

// The crop of each role as [width, height].
const ROLE_ASPECTS: Record<PhotoRole, readonly [number, number]> = {
	thumb: [1, 1],
	card: [3, 2],
	hero: [16, 9]
};

// AVIF first: browsers take the first <source> they support.
const SOURCE_FORMATS = [
	{ type: 'image/avif', extension: 'avif' },
	{ type: 'image/webp', extension: 'webp' }
] as const;
const FALLBACK_EXTENSION = 'jpg';

// Slug segments (the API's Slug pattern) joined by "/": no scheme, no "..",
// no extension, nothing that could point the URL somewhere else.
const PREFIX_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;

function widthLadder(url: string, role: PhotoRole, extension: string): string {
	return ROLE_WIDTHS[role].map((w) => `${url}-${w}w.${extension} ${w}w`).join(', ');
}

function assertValidPrefix(prefix: string): void {
	if (!PREFIX_PATTERN.test(prefix)) {
		throw new Error(`invalid media key prefix ${JSON.stringify(prefix)}`);
	}
}

// `dishes/tortilla/gal/hero-<hash>` -> AVIF, WebP and JPEG srcsets against the
// media base URL; null when there is no photo or no media origin configured.
export function imageSet({ baseUrl, prefix, role }: ImageSetOptions): ImageSet | null {
	if (prefix === null || !baseUrl) return null;
	assertValidPrefix(prefix);
	const url = `${baseUrl.replace(/\/$/, '')}/${prefix}`;
	return {
		sources: SOURCE_FORMATS.map(({ type, extension }) => ({
			type,
			srcset: widthLadder(url, role, extension)
		})),
		// Only a browser that ignores srcset reads src, so it gets the cheaper file.
		fallback: {
			src: `${url}-${ROLE_WIDTHS[role][0]}w.${FALLBACK_EXTENSION}`,
			srcset: widthLadder(url, role, FALLBACK_EXTENSION)
		}
	};
}

// "https://d1abc.cloudfront.net/media/" -> "https://d1abc.cloudfront.net/media";
// unset or empty -> undefined (every photo renders as the placeholder).
export function parseMediaBaseUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const url = URL.parse(value);
	const valid = url?.protocol === 'https:' && !url.username && !url.password && !/[?#]/.test(value);
	if (!valid) {
		throw new Error(
			`MEDIA_BASE_URL must be an https origin with an optional path, got ${JSON.stringify(value)}`
		);
	}
	return `${url.origin}${url.pathname}`.replace(/\/$/, '');
}

// The <img> width/height attributes: the smallest variant at the role's crop,
// so the browser reserves the right aspect before the file arrives.
export function intrinsicSize(role: PhotoRole): { width: number; height: number } {
	const [aspectWidth, aspectHeight] = ROLE_ASPECTS[role];
	const width = ROLE_WIDTHS[role][0];
	return { width, height: (width * aspectHeight) / aspectWidth };
}

export type SafeImageSetOptions = ImageSetOptions & { report?: (err: unknown) => void };

// For rendering: the backend validates prefixes, so a bad one is a contract
// violation. The photo falls back to the placeholder rather than failing the
// whole page; whether to log it is the caller's choice through `report`.
export function imageSetOrPlaceholder({
	report,
	...options
}: SafeImageSetOptions): ImageSet | null {
	try {
		return imageSet(options);
	} catch (err) {
		report?.(err);
		return null;
	}
}
