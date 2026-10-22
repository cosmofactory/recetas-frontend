import { expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { Component } from 'svelte';
import { overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { SearchEntry } from '#lib/search/search-index.ts';
import { DROPDOWN_TEST_ID, RESULT_TEST_IDS, SEARCH_COPY, type SearchLocale } from './search-copy';
import { fixtureIndex } from './search-overlay';
import { appendButton, settle } from './sheet';
import { loadHarness, loadSearchComponent, stage } from './ui';

// Browser-mode helpers for the FE-7 PR 4 DesktopSearch spec.
//
// Contract the spec assumes: src/lib/components/search/DesktopSearch.svelte,
// controlled like SearchOverlay. `open` shows the dropdown; onOpen asks to
// open it (focus, typing), onClose asks to close it (Escape, an outside
// click, focus leaving the search); onSelect(entry) reports a picked result
// (the screen navigates and closes it). The query is the component's own
// in-memory state (SearchCombobox). DesktopSearchHarness owns `open`, as a
// screen does.

export type DesktopSearchProps = {
	open: boolean;
	index: SearchEntry[];
	onOpen: () => void;
	onClose: () => void;
	onSelect: (entry: SearchEntry) => void;
};

type HarnessProps = Omit<DesktopSearchProps, 'open'> & {
	DesktopSearch: Component<DesktopSearchProps>;
	initialOpen: boolean;
};

// The top bar's right end: the field sits there, the dropdown hangs under it.
const FIELD_SLOT_STYLE = 'position: fixed; top: 16px; right: 24px; width: 320px';
const OUTSIDE_STYLE = 'position: fixed; bottom: 16px; left: 16px';

type RenderSpec = { open?: boolean; lang?: SearchLocale };

export async function renderDesktopSearch(spec: RenderSpec = {}) {
	const lang = spec.lang ?? 'en';
	overwriteGetLocale(() => lang);
	const DesktopSearch = await loadSearchComponent<DesktopSearchProps>('DesktopSearch');
	const Harness = await loadHarness<HarnessProps>('DesktopSearchHarness');
	const root = stage(FIELD_SLOT_STYLE);
	// After the search in the DOM, so Tab from the field reaches it.
	const outside = appendButton(stage(OUTSIDE_STYLE), 'Outside');
	const spies = { onOpen: vi.fn(), onClose: vi.fn(), onSelect: vi.fn() };
	const props = { DesktopSearch, initialOpen: spec.open ?? false, index: fixtureIndex(lang) };
	await render(Harness, { target: root, props: { ...props, ...spies } });
	settle();
	return { root, outside, ...spies, copy: SEARCH_COPY[lang] };
}

export function fieldInput(root: HTMLElement): HTMLInputElement {
	const input = root.querySelector<HTMLInputElement>('input[role="combobox"]');
	expect(input, 'got no <input role="combobox"> in the desktop search').not.toBeNull();
	return input!;
}

// The pill around the input (SearchField's test id).
export function fieldBox(root: HTMLElement): HTMLElement {
	const box = root.querySelector<HTMLElement>(`[data-testid="${RESULT_TEST_IDS.field}"]`);
	expect(box, `got no [data-testid="${RESULT_TEST_IDS.field}"] pill`).not.toBeNull();
	return box!;
}

export function dropdown(root: HTMLElement): HTMLElement | null {
	return root.querySelector<HTMLElement>(`[data-testid="${DROPDOWN_TEST_ID}"]`);
}

// Rendered, visible and opaque once transitions are over.
export function dropdownShown(root: HTMLElement): boolean {
	settle();
	const el = dropdown(root);
	if (!el) return false;
	return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

export function shownDropdown(root: HTMLElement): HTMLElement {
	expect(dropdownShown(root), 'want the dropdown shown').toBe(true);
	return dropdown(root)!;
}

// Focuses the field (as a click does), then types the query.
export async function typeInField(root: HTMLElement, query: string) {
	const input = fieldInput(root);
	await userEvent.click(input);
	await userEvent.fill(input, query);
	settle();
	return input;
}

export function dropdownOptions(root: HTMLElement): HTMLElement[] {
	return [...(dropdown(root)?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
}

const titleOf = (option: HTMLElement) =>
	option.querySelector(`[data-testid="${RESULT_TEST_IDS.title}"]`)?.textContent?.trim() ?? '';

export const dropdownTitles = (root: HTMLElement) => dropdownOptions(root).map(titleOf);

export function dropdownOption(root: HTMLElement, title: string): HTMLElement {
	const option = dropdownOptions(root).find((o) => titleOf(o) === title);
	expect(
		option,
		`got no option "${title}" in ${JSON.stringify(dropdownTitles(root))}`
	).toBeDefined();
	return option!;
}

export function activeDropdownTitle(root: HTMLElement): string | null {
	const id = fieldInput(root).getAttribute('aria-activedescendant');
	if (!id) return null;
	const option = document.getElementById(id);
	expect(option?.getAttribute('role'), `aria-activedescendant="${id}" must name an option`).toBe(
		'option'
	);
	return titleOf(option!);
}

// The innermost element inside the dropdown whose whole text is `text`.
export function textInDropdown(root: HTMLElement, text: string): HTMLElement | undefined {
	const all = [...(dropdown(root)?.querySelectorAll<HTMLElement>('*') ?? [])];
	const matches = all.filter((el) => el.textContent?.trim() === text);
	return matches.find((el) => !matches.some((other) => other !== el && el.contains(other)));
}

export function buttonNamed(root: HTMLElement, name: string): HTMLButtonElement | undefined {
	const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
	return buttons.find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
}
