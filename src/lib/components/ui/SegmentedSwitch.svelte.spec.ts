import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import {
	computed,
	expectFullyVisible,
	hitArea,
	loadUi,
	stage,
	style,
	textLineCount,
	transitionDuration
} from '../../../testutil/ui';

// FE-3 SegmentedSwitch: the "Regional | Popular" switch. Mobile README ->
// Header: "track: bg `--bg-segment-track`, radius 12px, padding 4px, gap 4px.
// Each segment flex:1, padding 9px 0, centred, Archivo 13px/600. Active: bg
// `--bg-surface`, radius 9px, shadow `--shadow-segment-active`. Bg transition
// 200ms." Desktop uses the same style at `clamp(240px, 22vw, 320px)` wide.
//
// Semantics (stage FE-3): an ARIA tablist with roving tabindex. ArrowLeft /
// ArrowRight move to the previous / next segment, wrapping at the ends; Home
// and End go to the first / last. Moving selects (automatic activation): the
// new segment gets focus and aria-selected, and onChange is called. `value`
// is bindable, so the switch also works when the caller doesn't bind it.

// panelId: the id of the tabpanel the tab controls (optional).
type Option = { value: string; label: string; panelId?: string };
type SwitchProps = {
	options: Option[];
	value: string;
	label: string;
	onChange?: (value: string) => void;
	size?: 'regular' | 'desktop';
};

const TABS: Option[] = [
	{ value: 'regional', label: 'Regional' },
	{ value: 'popular', label: 'Popular' }
];
const RU_TABS: Option[] = [
	{ value: 'regional', label: 'По регионам' },
	{ value: 'popular', label: 'Популярное' }
];
// Three segments, so wrapping and Home/End are told apart from "the other one".
const THREE: Option[] = [
	{ value: 'diet', label: 'Diet' },
	{ value: 'course', label: 'Course' },
	{ value: 'season', label: 'Season' }
];
const SWITCH_LABEL = 'Browse';
const HIT_MIN_PX = 44;
// Desktop top bar: switch "width `clamp(240px, 22vw, 320px)`"; its narrowest.
const NARROWEST = 'width: 240px; padding: 40px 0';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function renderSwitch(props: Partial<SwitchProps> = {}, target = stage(NARROWEST)) {
	const SegmentedSwitch = await loadUi<SwitchProps>('SegmentedSwitch');
	const all: SwitchProps = { options: TABS, value: TABS[0].value, label: SWITCH_LABEL, ...props };
	await render(SegmentedSwitch, { target, props: all });
	const tablist = page.getByRole('tablist', { name: SWITCH_LABEL });
	await expect.element(tablist).toBeInTheDocument();
	const tabs = all.options.map(
		(o) => page.getByRole('tab', { name: o.label, exact: true }).element() as HTMLElement
	);
	return { tablist: tablist.element() as HTMLElement, tabs };
}

function selected(tabs: HTMLElement[]): number[] {
	return tabs.flatMap((tab, i) => (tab.getAttribute('aria-selected') === 'true' ? [i] : []));
}

describe('SegmentedSwitch semantics', () => {
	it('is a named tablist with one tab per option, in order', async () => {
		const { tablist, tabs } = await renderSwitch();
		const owned = [...tablist.querySelectorAll('[role="tab"]')];
		expect(owned, 'got tabs outside the tablist or out of order').toEqual(tabs);
	});

	for (const [index, option] of TABS.entries()) {
		it(`marks only "${option.value}" selected and tabbable when it is the value`, async () => {
			const { tabs } = await renderSwitch({ value: option.value });
			expect(selected(tabs)).toEqual([index]);
			expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(
				TABS.map((_, i) => (i === index ? '0' : '-1'))
			);
		});
	}

	it('selects a clicked tab and calls onChange with its value', async () => {
		const onChange = vi.fn();
		const { tabs } = await renderSwitch({ onChange });
		await page.elementLocator(tabs[1]).click();
		expect(onChange.mock.calls).toEqual([['popular']]);
		expect(selected(tabs)).toEqual([1]);
	});

	it('does not call onChange when the selected tab is clicked again', async () => {
		const onChange = vi.fn();
		const { tabs } = await renderSwitch({ onChange });
		await page.elementLocator(tabs[0]).click();
		expect(onChange, 'got onChange for an unchanged value').not.toHaveBeenCalled();
	});
});

describe('SegmentedSwitch keyboard', () => {
	const moves: { from: number; key: string; to: number; name: string }[] = [
		{ from: 0, key: 'ArrowRight', to: 1, name: 'ArrowRight moves to the next tab' },
		{ from: 2, key: 'ArrowRight', to: 0, name: 'ArrowRight on the last tab wraps to the first' },
		{ from: 1, key: 'ArrowLeft', to: 0, name: 'ArrowLeft moves to the previous tab' },
		{ from: 0, key: 'ArrowLeft', to: 2, name: 'ArrowLeft on the first tab wraps to the last' },
		{ from: 2, key: 'Home', to: 0, name: 'Home moves to the first tab' },
		{ from: 0, key: 'End', to: 2, name: 'End moves to the last tab' }
	];
	for (const { from, key, to, name } of moves) {
		it(`${name}: focus, selection, tabindex and onChange follow`, async () => {
			const onChange = vi.fn();
			const { tabs } = await renderSwitch({ options: THREE, value: THREE[from].value, onChange });
			tabs[from].focus();
			await userEvent.keyboard(`{${key}}`);
			expect(document.activeElement, `got focus on ${document.activeElement?.textContent}`).toBe(
				tabs[to]
			);
			expect(selected(tabs)).toEqual([to]);
			expect(tabs[to].getAttribute('tabindex')).toBe('0');
			expect(onChange.mock.calls).toEqual([[THREE[to].value]]);
		});
	}

	it('is reached by Tab on the selected tab only (roving tabindex)', async () => {
		const target = stage(NARROWEST);
		const before = document.createElement('button');
		target.append(before);
		const { tabs } = await renderSwitch({ options: THREE, value: 'course' }, target);
		before.focus();
		await userEvent.tab();
		expect(document.activeElement, 'got Tab landing elsewhere').toBe(tabs[1]);
	});
});

// FE-3 review: a value that matches no option must not make the switch
// unreachable, so the first tab takes the tab stop. With a panelId, a tab
// names its panel (aria-controls) and has a stable id, `${panelId}-tab`, so
// the panel can point back with aria-labelledby (WAI-ARIA tabs pattern).
describe('SegmentedSwitch edge cases', () => {
	it('gives the first tab the tab stop when the value matches no option', async () => {
		const target = stage(NARROWEST);
		const before = document.createElement('button');
		target.append(before);
		const { tabs } = await renderSwitch({ options: THREE, value: 'unknown' }, target);
		expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
		expect(selected(tabs), 'got a tab selected for an unknown value').toEqual([]);
		before.focus();
		await userEvent.tab();
		expect(document.activeElement, 'got Tab skipping the tablist').toBe(tabs[0]);
	});

	const WITH_PANELS: Option[] = [
		{ value: 'regional', label: 'Regional', panelId: 'home-regional' },
		{ value: 'popular', label: 'Popular', panelId: 'home-popular' }
	];

	it('links each tab to its panel with aria-controls and an id of `${panelId}-tab`', async () => {
		const { tabs } = await renderSwitch({ options: WITH_PANELS });
		const got = tabs.map((t) => [t.getAttribute('aria-controls'), t.id]);
		expect(got).toEqual([
			['home-regional', 'home-regional-tab'],
			['home-popular', 'home-popular-tab']
		]);
	});

	it('keeps the tab ids when the selection changes', async () => {
		const { tabs } = await renderSwitch({ options: WITH_PANELS });
		await page.elementLocator(tabs[1]).click();
		expect(tabs.map((t) => t.id)).toEqual(['home-regional-tab', 'home-popular-tab']);
	});

	it('renders no aria-controls without a panelId', async () => {
		const { tabs } = await renderSwitch();
		expect(tabs.map((t) => t.hasAttribute('aria-controls'))).toEqual([false, false]);
	});
});

describe('SegmentedSwitch look', () => {
	// "track: bg `--bg-segment-track`, radius 12px, padding 4px, gap 4px".
	it('draws the track: --bg-segment-track, radius 12px, padding 4px, gap 4px', async () => {
		const { tablist } = await renderSwitch();
		const got = {
			background: style(tablist, 'background-color'),
			radius: style(tablist, 'border-top-left-radius'),
			padding: style(tablist, 'padding'),
			gap: style(tablist, 'column-gap')
		};
		expect(got).toEqual({
			background: computed('background-color', 'var(--bg-segment-track)'),
			radius: computed('border-top-left-radius', 'var(--radius-segment-track)'),
			padding: '4px',
			gap: '4px'
		});
	});

	// "Each segment flex:1, padding 9px 0, centred, Archivo 13px/600".
	it('gives each segment an equal share, padding 9px 0 and centred 13px/600 Archivo text', async () => {
		const { tabs } = await renderSwitch({ options: RU_TABS });
		const widths = tabs.map((t) => t.getBoundingClientRect().width);
		expect(widths[0], `got segment widths ${widths}`).toBeCloseTo(widths[1], 0);
		for (const tab of tabs) {
			const got = [
				'padding-top',
				'padding-bottom',
				'text-align',
				'font-size',
				'font-weight',
				'font-family'
			].map((p) => style(tab, p));
			expect(got).toEqual([
				'9px',
				'9px',
				'center',
				'13px',
				'600',
				computed('font-family', 'var(--font-text)')
			]);
		}
	});

	// "Active: bg `--bg-surface`, radius 9px, shadow `--shadow-segment-active`".
	it('paints the active segment: --bg-surface, radius 9px, --shadow-segment-active', async () => {
		const { tabs } = await renderSwitch({ value: 'popular' });
		const got = ['background-color', 'border-top-left-radius', 'box-shadow'].map((p) =>
			style(tabs[1], p)
		);
		expect(got).toEqual([
			computed('background-color', 'var(--bg-surface)'),
			computed('border-top-left-radius', 'var(--radius-segment)'),
			computed('box-shadow', 'var(--shadow-segment-active)')
		]);
	});

	it('leaves the inactive segment unpainted: no background, no shadow', async () => {
		const { tabs } = await renderSwitch({ value: 'popular' });
		expect(style(tabs[0], 'background-color')).toBe(TRANSPARENT);
		expect(style(tabs[0], 'box-shadow')).toBe('none');
	});

	// "Bg transition 200ms" = --dur-colour.
	it('transitions the segment background over --dur-colour (200ms)', async () => {
		const { tabs } = await renderSwitch();
		const want = computed('transition-duration', 'var(--dur-colour)');
		expect(tabs.map((t) => transitionDuration(t, 'background-color'))).toEqual([want, want]);
	});
});

describe('SegmentedSwitch fit', () => {
	it(`gives every segment a hit area at least ${HIT_MIN_PX}px tall`, async () => {
		const { tabs } = await renderSwitch();
		for (const tab of tabs) {
			const { height } = hitArea(tab);
			expect(height, `got hit height ${height} for ${tab.textContent}`).toBeGreaterThanOrEqual(
				HIT_MIN_PX
			);
		}
	});

	// Localization -> Length: "Segment labels ... must not truncate".
	it('shows the ru labels in full, on one line, at the narrowest desktop width (240px)', async () => {
		const { tabs } = await renderSwitch({ options: RU_TABS });
		tabs.forEach((tab, i) => {
			expectFullyVisible(tab, RU_TABS[i].label);
			expect(textLineCount(tab), `got "${RU_TABS[i].label}" on several lines`).toBe(1);
		});
	});
});

// Desktop prototype (Asadorov Desktop.dc.html l.22–23): the top bar's
// segments are `font-size:13.5px; font-weight:600`, where the mobile switch
// is 13px; prototype wins (FE-3 owner decision). `size="desktop"` selects
// it (like PrimaryButton's size="compact"); the default stays the mobile
// "regular" 13px.
describe('SegmentedSwitch desktop size', () => {
	const sizes: { size?: 'regular' | 'desktop'; fontSize: string }[] = [
		{ fontSize: '13px' },
		{ size: 'regular', fontSize: '13px' },
		{ size: 'desktop', fontSize: '13.5px' }
	];
	for (const { size, fontSize } of sizes) {
		it(`sets the segments in ${fontSize}/600 with size ${size ?? '(default)'}`, async () => {
			const { tabs } = await renderSwitch(size ? { size } : {});
			for (const tab of tabs) {
				expect([style(tab, 'font-size'), style(tab, 'font-weight')]).toEqual([fontSize, '600']);
			}
		});
	}

	it('shows the ru labels in full on one line at desktop size, at its narrowest', async () => {
		const { tabs } = await renderSwitch({ options: RU_TABS, size: 'desktop' });
		tabs.forEach((tab, i) => {
			expectFullyVisible(tab, RU_TABS[i].label);
			expect(textLineCount(tab), `got "${RU_TABS[i].label}" on several lines`).toBe(1);
		});
	});
});
