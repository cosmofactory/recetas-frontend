import type { components } from './schema.d.ts';

// tileColor is null when the API sent anything but #RRGGBB
// (#lib/server/region-colour.ts). Client-safe, unlike #lib/server.
export type ValidatedColour<T> = Omit<T, 'tileColor'> & { tileColor: string | null };
export type CatalogRegion = ValidatedColour<components['schemas']['Region']>;
