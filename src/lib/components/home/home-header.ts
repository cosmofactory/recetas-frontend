import { m } from '#lib/paraglide/messages.js';
import { HOME_TABS, TAB_PANEL_IDS, tabHref, type HomeTab } from '#lib/ui/home-tab.ts';

const TAB_LABELS: Record<HomeTab, () => string> = {
	regional: m.home_regional,
	popular: m.home_popular
};

// The Regional | Popular options, each a link to its tab URL. The page
// renders two switches (mobile header and desktop top bar); only one may
// carry the panel ids, or the HTML would repeat them. A function, so the
// labels resolve per request.
export function tabOptions(lang: string, withPanelIds: boolean) {
	return HOME_TABS.map((tab) => ({
		value: tab,
		label: TAB_LABELS[tab](),
		href: tabHref(tab, lang),
		panelId: withPanelIds ? TAB_PANEL_IDS[tab] : undefined
	}));
}
