import type { IconName } from '#lib/components/ui/icons.ts';
import type { PhotoRole } from '#lib/media.ts';
import { m } from '#lib/paraglide/messages.js';

// What the dev-only /:lang/_dev/ui gallery shows. Functions, so the messages
// resolve in the request's locale.

export function iconButtons(): { icon: IconName; label: string }[] {
	return [
		{ icon: 'search', label: m.a11y_search() },
		{ icon: 'back', label: m.a11y_back() },
		{ icon: 'close', label: m.a11y_close() },
		{ icon: 'check', label: m.a11y_check() }
	];
}

export function filterLabels(): string[] {
	return [
		m.home_filterLabels_vegetarian(),
		m.home_filterLabels_seafood(),
		m.home_filterLabels_withPork(),
		m.home_filterLabels_tapas(),
		m.home_filterLabels_mains(),
		m.home_filterLabels_desserts(),
		m.home_filterLabels_quick(),
		m.home_filterLabels_slowCooked(),
		m.home_filterLabels_summer(),
		m.home_filterLabels_winter(),
		m.home_filterLabels_holyWeek(),
		m.home_filterLabels_allYear()
	];
}

export function browseTabs(): { value: string; label: string }[] {
	return [
		{ value: 'regional', label: m.home_regional() },
		{ value: 'popular', label: m.home_popular() }
	];
}

type PhotoSlot = { role: PhotoRole; height: string; radius: string; placeholder: boolean };

// Mobile README sizes: dish card photo "height 96px, radius 11px"; dish hero
// "height 180px, radius 16px". The last slot shows the missing-photo stripes.
export const PHOTO_SLOTS: PhotoSlot[] = [
	{ role: 'card', height: '96px', radius: '11px', placeholder: false },
	{ role: 'hero', height: '180px', radius: 'var(--radius-card)', placeholder: false },
	{ role: 'card', height: '96px', radius: '11px', placeholder: true }
];

export const PHOTO_SIZES = '100vw';
