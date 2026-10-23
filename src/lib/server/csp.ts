// kit.csp (vite.config.ts) is fixed at build time, but photos come from the
// runtime MEDIA_BASE_URL, so its origin joins img-src per response
// (stage FE-8, Small decisions -> CSP).
export const CSP_HEADER = 'content-security-policy';
const IMG_SRC = 'img-src';

// "default-src 'self'; img-src 'self'" + "https://cdn.test" ->
// "default-src 'self'; img-src 'self' https://cdn.test". A policy without
// img-src is returned unchanged.
export function withImgSource(policy: string, source: string): string {
	return policy
		.split(';')
		.map((directive) => {
			const [name] = directive.trim().split(/\s+/);
			return name?.toLowerCase() === IMG_SRC ? `${directive.trimEnd()} ${source}` : directive;
		})
		.join(';');
}

// Adds the media origin (MEDIA_BASE_URL is already validated as https, see
// parseMediaBaseUrl) to the response's CSP, if it has one.
export function withMediaImgSrc(response: Response, mediaBaseUrl: string | undefined): Response {
	const policy = response.headers.get(CSP_HEADER);
	if (!policy || !mediaBaseUrl) return response;
	response.headers.set(CSP_HEADER, withImgSource(policy, new URL(mediaBaseUrl).origin));
	return response;
}
