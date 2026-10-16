import type { components } from '#lib/api/schema.d.ts';

// The bundle's enum fields arrive as plain strings (a JSON import has no
// literal types); these check them against the OpenAPI enums.

type Schemas = components['schemas'];
type Course = Schemas['Course'];
type Season = Schemas['Season'];
type Unit = Schemas['Unit'];

const COURSES: readonly Course[] = ['tapas', 'mains', 'desserts'];
const SEASONS: readonly Season[] = ['summer', 'winter', 'easter', 'all'];
const UNITS: readonly Unit[] = ['g', 'ml', 'tsp', null];

function isOneOf<T extends string | null>(allowed: readonly T[], value: string | null): value is T {
	return (allowed as readonly (string | null)[]).includes(value);
}

function oneOf<T extends string | null>(
	allowed: readonly T[],
	value: string | null,
	field: string
) {
	if (isOneOf(allowed, value)) return value;
	throw new Error(`content bundle: ${field} ${JSON.stringify(value)} is not one of ${allowed}`);
}

export const parseCourse = (value: string): Course => oneOf(COURSES, value, 'course');
export const parseSeason = (value: string): Season => oneOf(SEASONS, value, 'season');
export const parseUnit = (value: string | null): Unit => oneOf(UNITS, value, 'unit');
