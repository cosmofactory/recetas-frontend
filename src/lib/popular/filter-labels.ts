import { DOT_SEPARATOR, formatNumber } from '#lib/i18n/format.ts';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';
import type { Locale } from '#lib/i18n/locales.ts';
import type { FilterGroupKey, FilterId } from './filters.ts';

type LabelMessage = (inputs?: Record<string, never>, options?: { locale?: Locale }) => string;

// strings.json -> home.filterLabels, by filter id.
const FILTER_LABELS: Record<FilterId, LabelMessage> = {
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

// In `locale`, else the request's locale.
export const filterLabel = (id: FilterId, locale?: Locale): string =>
	FILTER_LABELS[id]({}, { locale });

// strings.json -> home.diet / course / effort / season: the groups' eyebrows.
const GROUP_LABELS: Record<FilterGroupKey, () => string> = {
	diet: m.home_diet,
	course: m.home_course,
	effort: m.home_effort,
	season: m.home_season
};

export const filterGroupLabel = (key: FilterGroupKey): string => GROUP_LABELS[key]();

// Mobile README -> Filter bar: "Filters", or "Filters · N" when N filters
// are active (prototype countLabel: filters + ' · ' + active.length).
export function filtersButtonLabel(activeCount: number): string {
	if (activeCount === 0) return m.home_filters();
	return [m.home_filters(), formatNumber(getLocale(), activeCount)].join(DOT_SEPARATOR);
}
