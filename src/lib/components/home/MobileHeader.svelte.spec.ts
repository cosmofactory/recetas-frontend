import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { LOGO } from '../../../testutil/about-copy';
import { loadHome, stage, useViewport } from '../../../testutil/ui';

// FE-9 FB-8 (D-FE9-4), MobileHeader: the logo stops being the page's <h1>.
// Mobile README -> Regional tab — body -> About: "The title is the page's
// one h1; the logo isn't a heading." The logo stays on screen as before
// (home-header.e2e.ts pins its look); only its element changes. Desktop's
// logo was already a link, not a heading.

type MobileHeaderProps = {
	tabs: { options: { value: string; label: string }[]; value: string; label: string };
	language: { code: string; label: string; expanded: boolean };
	search: { label: string; expanded: boolean; onclick: () => void };
};

const PROPS: MobileHeaderProps = {
	tabs: {
		options: [
			{ value: 'regional', label: 'Regional' },
			{ value: 'popular', label: 'Popular' }
		],
		value: 'regional',
		label: 'Browse'
	},
	language: { code: 'en', label: 'Language', expanded: false },
	search: { label: 'Search', expanded: false, onclick: () => {} }
};

async function renderHeader(): Promise<HTMLElement> {
	const MobileHeader = await loadHome<MobileHeaderProps>('MobileHeader');
	const target = stage('background: var(--bg-page)');
	render(MobileHeader, { target, props: PROPS });
	return target;
}

function logoElement(root: HTMLElement): HTMLElement | undefined {
	return [...root.querySelectorAll<HTMLElement>('*')].find(
		(el) => el.textContent?.trim() === LOGO && el.children.length === 0
	);
}

describe('MobileHeader logo', () => {
	useViewport(390, 844);

	it(`shows the logo "${LOGO}"`, async () => {
		const logo = logoElement(await renderHeader());
		expect(logo, `got no "${LOGO}" element`).toBeDefined();
		expect(logo!.checkVisibility(), 'got the logo hidden').toBe(true);
	});

	it('renders no heading: the about title is the page h1', async () => {
		const root = await renderHeader();
		const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')];
		expect(
			headings.map((h) => h.outerHTML),
			'got a heading in the mobile header'
		).toEqual([]);
	});
});
