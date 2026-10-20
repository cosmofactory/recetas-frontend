import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { loadUi, stage } from '../../../testutil/ui';

// FE-4 PR 2 review (stage FE-4 -> Small decisions, "Tabs are links"): a
// SegmentedSwitch option may carry an `href`; that tab is then
// <a role="tab" href>, so switching works without JS and crawlers find the
// Popular URL. A click is the browser's own link navigation (one history
// entry; SvelteKit's router takes it over when hydrated), so the switch must
// not cancel it. JS adds the tablist keyboard model on top: roving tabindex
// and arrow keys select (onChange) and move focus, as for button tabs.
// Without `href` a tab stays a <button> (SegmentedSwitch.svelte.spec.ts).

type Option = { value: string; label: string; href?: string; panelId?: string };
type SwitchProps = {
	options: Option[];
	value: string;
	label: string;
	onChange?: (value: string) => void;
};

const LINKED: Option[] = [
	{ value: 'regional', label: 'Regional', href: '/en/' },
	{ value: 'popular', label: 'Popular', href: '/en/?tab=popular' }
];
const SWITCH_LABEL = 'Browse';

async function renderSwitch(props: Partial<SwitchProps> = {}) {
	const SegmentedSwitch = await loadUi<SwitchProps>('SegmentedSwitch');
	const all: SwitchProps = {
		options: LINKED,
		value: LINKED[0].value,
		label: SWITCH_LABEL,
		...props
	};
	await render(SegmentedSwitch, { target: stage('width: 320px; padding: 40px'), props: all });
	await expect.element(page.getByRole('tablist', { name: SWITCH_LABEL })).toBeInTheDocument();
	return all.options.map(
		(o) => page.getByRole('tab', { name: o.label, exact: true }).element() as HTMLElement
	);
}

// Records whether a click reached the window uncancelled, then cancels it
// so the test page itself doesn't navigate away.
function watchClicks(): { defaultPrevented: boolean[] } {
	const seen = { defaultPrevented: [] as boolean[] };
	const listener = (event: MouseEvent) => {
		seen.defaultPrevented.push(event.defaultPrevented);
		event.preventDefault();
	};
	window.addEventListener('click', listener);
	cleanups.push(() => window.removeEventListener('click', listener));
	return seen;
}

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

describe('SegmentedSwitch with link options', () => {
	it('renders each option with an href as <a role="tab"> with that href', async () => {
		const tabs = await renderSwitch();
		for (const [i, tab] of tabs.entries()) {
			expect(tab.tagName, `got <${tab.tagName}> for ${LINKED[i].label}`).toBe('A');
			expect(tab.getAttribute('href')).toBe(LINKED[i].href);
		}
	});

	it('keeps aria-selected and the roving tabindex on links', async () => {
		const tabs = await renderSwitch({ value: 'popular' });
		expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
		expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0]);
	});

	it('keeps panelId wiring (id and aria-controls) on links', async () => {
		const options = LINKED.map((o) => ({ ...o, panelId: `panel-${o.value}` }));
		const tabs = await renderSwitch({ options });
		expect(tabs[1].id).toBe('panel-popular-tab');
		expect(tabs[1].getAttribute('aria-controls')).toBe('panel-popular');
	});

	it('ArrowRight selects the next link tab, focuses it and calls onChange', async () => {
		const onChange = vi.fn();
		const tabs = await renderSwitch({ onChange });
		tabs[0].focus();
		await userEvent.keyboard('{ArrowRight}');
		expect(onChange).toHaveBeenCalledExactlyOnceWith('popular');
		expect(document.activeElement, 'want focus on Popular').toBe(tabs[1]);
		expect(tabs[1].getAttribute('aria-selected')).toBe('true');
		expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0]);
	});

	it('a click on a link tab is left to the browser (not cancelled)', async () => {
		const tabs = await renderSwitch();
		const seen = watchClicks();
		tabs[1].click();
		expect(seen.defaultPrevented, 'want one click, not cancelled by the switch').toEqual([false]);
	});

	it('an option without href is still a <button>', async () => {
		const options = [LINKED[0], { value: 'popular', label: 'Popular' }];
		const tabs = await renderSwitch({ options });
		expect(tabs[0].tagName).toBe('A');
		expect(tabs[1].tagName).toBe('BUTTON');
		expect(tabs[1].getAttribute('type')).toBe('button');
	});
});
