import { m } from '#lib/paraglide/messages.js';
import { POPULAR, type HomeTab } from '#lib/ui/home-tab.ts';

// The design has no meta strings (stage FE-4, Small decisions): the home is
// "Asadorov · {aboutTitle}", Popular adds its tab label, and the
// description is the desktop about paragraph. A region page is
// "Asadorov · {region name}" (its description is the region's).
const SITE_NAME = 'Asadorov';
const TITLE_SEPARATOR = ' · ';

export function homeTitle(tab: HomeTab): string {
	const tabLabel = tab === POPULAR ? [m.home_popular()] : [];
	return [SITE_NAME, ...tabLabel, m.desktop_aboutTitle()].join(TITLE_SEPARATOR);
}

export const regionTitle = (regionName: string): string =>
	[SITE_NAME, regionName].join(TITLE_SEPARATOR);

export const homeDescription = (): string => m.desktop_aboutBody();
