import { DOT_SEPARATOR, formatNumber } from '#lib/i18n/format.ts';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { FilterId } from './filters.ts';

// strings.json -> home.filterLabels, by filter id.
const FILTER_LABELS: Record<FilterId, () => string> = {
	vegetarian: m.home_filterLabels_vegetarian,
	seafood: m.home_filterLabels_seafood,
	pork: m.home_filterLabels_withPork,
	tapas: m.home_filterLabels_tapas,
	mains: m.home_filterLabels_mains,
	desserts: m.home_filterLabels_desserts,
	quick: m.home_filterLabels_quick,
	'slow-cooked': m.home_filterLabels_slowCooked,
	summer: m.home_filterLabels_summer,
	winter: m.home_filterLabels_winter,
	easter: m.home_filterLabels_holyWeek,
	'all-year': m.home_filterLabels_allYear
};

export const filterLabel = (id: FilterId): string => FILTER_LABELS[id]();

// Mobile README -> Filter bar: "Filters", or "Filters · N" when N filters
// are active (prototype countLabel: filters + ' · ' + active.length).
export function filtersButtonLabel(activeCount: number): string {
	if (activeCount === 0) return m.home_filters();
	return [m.home_filters(), formatNumber(getLocale(), activeCount)].join(DOT_SEPARATOR);
}
