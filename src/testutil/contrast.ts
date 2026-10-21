// WCAG 2.x contrast math for tests (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio):
// parse a CSS colour, composite a translucent colour over an opaque one, and
// compute the contrast ratio. Test code only.

export type Rgba = { r: number; g: number; b: number; a: number };

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

// #RRGGBB or rgb()/rgba() with comma-separated channels, as the token files write them.
export function parseColour(value: string): Rgba {
	const v = value.trim();
	const hex = HEX.exec(v);
	if (hex)
		return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
	const rgba = RGBA.exec(v);
	if (!rgba) throw new Error(`unsupported colour ${JSON.stringify(value)}`);
	const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map(Number);
	return { r, g, b, a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
}

// Source-over: `top` painted on an opaque `bottom`.
export function composite(top: Rgba, bottom: Rgba): Rgba {
	const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
	return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgba): number {
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
	const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}
