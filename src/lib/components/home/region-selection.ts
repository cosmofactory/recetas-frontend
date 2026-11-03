// The URL's region, if the catalog has it. Neither layout has a default
// (D-FE9-8): the bare home selects nothing.
export function findRegion<R extends { key: string }>(
	regions: readonly R[],
	key: string | undefined
): R | undefined {
	return key === undefined ? undefined : regions.find((region) => region.key === key);
}
