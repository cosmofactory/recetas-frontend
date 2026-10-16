// DATA_SOURCE picks where the catalog comes from: `api` (the default) or
// `mock`, the vendored bundle for local dev and tests. Anything else is a
// configuration error, never a silent fallback.

export const dataSourceKinds = ['api', 'mock'] as const;
export type DataSourceKind = (typeof dataSourceKinds)[number];

const DEFAULT_KIND: DataSourceKind = 'api';

function isDataSourceKind(value: string): value is DataSourceKind {
	return (dataSourceKinds as readonly string[]).includes(value);
}

export function selectSource(env: { DATA_SOURCE?: string }): DataSourceKind {
	const value = env.DATA_SOURCE;
	if (!value) return DEFAULT_KIND;
	if (isDataSourceKind(value)) return value;
	throw new Error(
		`DATA_SOURCE must be one of ${dataSourceKinds.join(', ')}, got ${JSON.stringify(value)}`
	);
}
