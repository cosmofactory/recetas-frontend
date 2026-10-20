import type { Snippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { CONTENT_TEST_ID, content, screenFrame, settle } from '../../../testutil/sheet';
import { loadUi, stage } from '../../../testutil/ui';

// FE-3 content vs container (F6). Stage FE-3: "Containers (`BottomSheet` on
// mobile, `StickyPanel` on desktop) take content through snippets. Content
// components ... receive only data and callbacks." Desktop README: the
// region panel shows the same region details as the mobile sheet. So one
// content snippet must come out of either container as the same markup: the
// container wraps it and never rewrites, restyles or duplicates it.

type BottomSheetProps = {
	state: 'expanded';
	onStateChange: () => void;
	label: string;
	handleLabel: string;
	children: Snippet;
};
type StickyPanelProps = { label: string; children: Snippet };

// A region-details-like content root: a heading, text and a control.
const REGION_HTML =
	`<section data-testid="${CONTENT_TEST_ID}" class="region-details">` +
	'<h2>Galicia</h2><p>Atlantic coast, octopus and empanadas.</p>' +
	'<button type="button">Pulpo á feira</button></section>';

async function contentInBottomSheet(): Promise<HTMLElement[]> {
	const BottomSheet = await loadUi<BottomSheetProps>('BottomSheet');
	const frame = screenFrame();
	await render(BottomSheet, {
		target: frame,
		props: {
			state: 'expanded',
			onStateChange: () => {},
			label: 'Galicia',
			handleLabel: 'Expand',
			children: content(REGION_HTML)
		}
	});
	settle();
	return [...frame.querySelectorAll<HTMLElement>(`[data-testid="${CONTENT_TEST_ID}"]`)];
}

async function contentInStickyPanel(): Promise<HTMLElement[]> {
	const StickyPanel = await loadUi<StickyPanelProps>('StickyPanel');
	const target = stage();
	await render(StickyPanel, {
		target,
		props: { label: 'Galicia', children: content(REGION_HTML) }
	});
	return [...target.querySelectorAll<HTMLElement>(`[data-testid="${CONTENT_TEST_ID}"]`)];
}

describe('one content snippet in either container', () => {
	it('renders exactly once in each', async () => {
		const inSheet = await contentInBottomSheet();
		const inPanel = await contentInStickyPanel();
		expect([inSheet.length, inPanel.length]).toEqual([1, 1]);
	});

	it('renders the same markup in BottomSheet and StickyPanel', async () => {
		const [inSheet] = await contentInBottomSheet();
		const [inPanel] = await contentInStickyPanel();
		expect(inSheet?.outerHTML, 'got the sheet changing the content').toBe(REGION_HTML);
		expect(inPanel?.outerHTML, 'got the panel changing the content').toBe(REGION_HTML);
	});
});
