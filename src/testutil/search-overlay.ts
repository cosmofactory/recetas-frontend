import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { buildIndex, type SearchCatalog, type SearchEntry } from '#lib/search/search-index.ts';
import { RESULT_TEST_IDS, SEARCH_COPY, type SearchLocale } from './search-copy';
import { appendButton, screenFrame, settle } from './sheet';
import { loadSearchComponent } from './ui';

// Browser-mode helpers for the FE-7 PR 2 SearchOverlay spec.
//
// Contract the spec assumes: src/lib/components/search/SearchOverlay.svelte,
// controlled like OverlaySheet. `open` shows it, `onClose` asks to close it
// (Cancel, Escape), `onSelect(entry)` reports a picked result (the screen
// navigates and closes it). `index` is buildIndex's output for the page's
// locale; the copy comes from the Paraglide locale.

export type SearchOverlayProps = {
	open: boolean;
	index: SearchEntry[];
	onClose: () => void;
	onSelect: (entry: SearchEntry) => void;
};

type Variation = SearchCatalog['dishes'][number]['variations'][number];

const NO_PHOTOS = { thumb: null, card: null, hero: null } as unknown as Variation['photos'];

function variation(
	fields: Pick<Variation, 'regionKey' | 'regionName' | 'name'> & Partial<Variation>
) {
	return {
		recipeKey: `${fields.regionKey}-r`,
		nameEs: fields.name,
		description: '',
		photos: NO_PHOTOS,
		...fields
	};
}

// A long regional dish list, so the region's subtitle overflows its row.
export const LONG_SUBTITLE_DISHES = [
	'Cochinillo asado',
	'Lechazo asado',
	'Sopa castellana',
	'Morcilla de Burgos',
	'Hornazo de Salamanca',
	'Botillo del Bierzo'
];

// A small catalog: query "tortilla" finds the dish and its two variations
// (dish → variation group boundary for the arrow keys); "galicia" a
// variation and a region; "onion" one variation by its description only.
export const FIXTURE_CATALOG: SearchCatalog = {
	regions: [
		{
			key: 'gal',
			name: 'Galicia',
			nameEs: 'Galicia',
			tileColor: '#9A9A5E',
			regionalDishes: ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos']
		},
		{
			key: 'and',
			name: 'Andalucía',
			nameEs: 'Andalucía',
			tileColor: '#C4552E',
			regionalDishes: ['Gazpacho andaluz', 'Salmorejo cordobés', 'Pescaíto frito']
		},
		{
			key: 'cyl',
			name: 'Castilla y León',
			nameEs: 'Castilla y León',
			tileColor: '#B88A3E',
			regionalDishes: LONG_SUBTITLE_DISHES
		}
	],
	dishes: [
		{
			key: 'tortilla',
			name: 'Tortilla de patatas',
			nameEs: 'Tortilla de patatas',
			variations: [
				variation({ regionKey: 'gal', regionName: 'Galicia', name: 'Betanzos-style runny' }),
				variation({
					regionKey: 'and',
					regionName: 'Andalucía',
					name: 'Sacromonte',
					description: 'Slow-cooked onion folded in'
				})
			]
		},
		{
			key: 'paella',
			name: 'Rice dishes',
			nameEs: 'Arroces',
			variations: [
				variation({
					regionKey: 'val',
					regionName: 'Comunidad Valenciana',
					name: 'Paella valenciana'
				})
			]
		}
	]
};

export const fixtureIndex = (lang: SearchLocale = 'en') => buildIndex(FIXTURE_CATALOG, lang);

type RenderSpec = { open?: boolean; lang?: SearchLocale; frame?: HTMLElement };

export async function renderSearch(spec: RenderSpec = {}) {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const SearchOverlay = await loadSearchComponent<SearchOverlayProps>('SearchOverlay');
	const frame = spec.frame ?? screenFrame();
	const opener = appendButton(frame, 'Opener');
	const onClose = vi.fn();
	const onSelect = vi.fn();
	const props = { open: spec.open ?? true, index: fixtureIndex(lang), onClose, onSelect };
	const result = await render(SearchOverlay, { target: frame, props });
	settle();
	// Opens or closes and leaves the transition running.
	const startOpen = (open: boolean) => result.rerender({ open });
	const setOpen = async (open: boolean) => {
		await startOpen(open);
		settle();
	};
	return { frame, opener, onClose, onSelect, startOpen, setOpen, copy: SEARCH_COPY[lang] };
}

// The overlay's dialog (named like the header's search button).
const SEARCH_DIALOG_NAMES = new Set(Object.values(SEARCH_COPY).map((copy) => copy.dialog));

// Found by its accessible name, so another dialog (the Filters sheet) earlier
// in the DOM can't be mistaken for it.
export function searchDialog(frame: HTMLElement): HTMLElement {
	const dialogs = [...frame.querySelectorAll<HTMLElement>('[role="dialog"]')];
	const dialog = dialogs.find((el) => SEARCH_DIALOG_NAMES.has(accessibleNameOf(el)));
	expect(dialog, 'got no role="dialog" named as the search').toBeDefined();
	return dialog!;
}

export function searchInput(frame: HTMLElement): HTMLInputElement {
	const input = searchDialog(frame).querySelector<HTMLInputElement>('input[role="combobox"]');
	expect(input, 'got no <input role="combobox"> in the dialog').not.toBeNull();
	return input!;
}

// Waits for the field's focus (it moves in once the enter transition ends).
export async function focusedInput(frame: HTMLElement): Promise<HTMLInputElement> {
	const input = searchInput(frame);
	await expect.poll(() => document.activeElement, { timeout: 2000 }).toBe(input);
	return input;
}

export async function typeQuery(frame: HTMLElement, query: string) {
	await userEvent.fill(searchInput(frame), query);
}

export function options(frame: HTMLElement): HTMLElement[] {
	return [...searchDialog(frame).querySelectorAll<HTMLElement>('[role="option"]')];
}

export function optionTitles(frame: HTMLElement): string[] {
	return options(frame).map((option) => partOf(option, 'title').textContent?.trim() ?? '');
}

export function partOf(option: HTMLElement, part: 'thumb' | 'title' | 'subtitle'): HTMLElement {
	const el = option.querySelector<HTMLElement>(`[data-testid="${RESULT_TEST_IDS[part]}"]`);
	expect(el, `got no ${RESULT_TEST_IDS[part]} in the option`).not.toBeNull();
	return el!;
}

export function optionTitled(frame: HTMLElement, title: string): HTMLElement {
	const option = options(frame).find((o) => partOf(o, 'title').textContent?.trim() === title);
	expect(
		option,
		`got no option titled "${title}" in ${JSON.stringify(optionTitles(frame))}`
	).toBeDefined();
	return option!;
}

// The groups (role="group") inside the listbox, each named by its heading.
export function groupNames(frame: HTMLElement): string[] {
	const groups = [
		...searchDialog(frame).querySelectorAll<HTMLElement>('[role="listbox"] [role="group"]')
	];
	return groups.map((group) => accessibleNameOf(group));
}

function accessibleNameOf(el: HTMLElement): string {
	const ids = el.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
	const labelled = ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '');
	return labelled.join(' ').trim() || (el.getAttribute('aria-label') ?? '');
}

// The active option: the one aria-activedescendant names, checked against
// aria-selected (the listbox's single selection follows the active option).
export function activeOption(frame: HTMLElement): HTMLElement | null {
	const id = searchInput(frame).getAttribute('aria-activedescendant');
	if (!id) return null;
	const option = document.getElementById(id);
	expect(option?.getAttribute('role'), `aria-activedescendant="${id}" must name an option`).toBe(
		'option'
	);
	return option;
}

export function activeTitle(frame: HTMLElement): string | null {
	const option = activeOption(frame);
	return option ? (partOf(option, 'title').textContent?.trim() ?? '') : null;
}

export function selectedOptions(frame: HTMLElement): HTMLElement[] {
	return options(frame).filter((o) => o.getAttribute('aria-selected') === 'true');
}

// The visible element whose whole text is `text` inside the dialog.
export function textIn(frame: HTMLElement, text: string): HTMLElement | undefined {
	const all = [...searchDialog(frame).querySelectorAll<HTMLElement>('*')];
	const matches = all.filter((el) => el.textContent?.trim() === text);
	return matches.find((el) => !matches.some((other) => other !== el && el.contains(other)));
}
