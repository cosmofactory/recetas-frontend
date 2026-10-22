import { DOT_SEPARATOR } from '#lib/i18n/format.ts';

// Every page title leads with the site's name, which is never translated
// ("Asadorov · Popular · …", "Asadorov · {dish} · {variation}").
export const SITE_NAME = 'Asadorov';

export const pageTitle = (...parts: string[]): string => [SITE_NAME, ...parts].join(DOT_SEPARATOR);
