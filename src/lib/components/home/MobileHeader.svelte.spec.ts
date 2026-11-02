import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { LOGO } from '../../../testutil/about-copy';
import { computed, hitArea, loadHome, stage, style, useViewport } from '../../../testutil/ui';

// FE-9 FB-8 (D-FE9-4), MobileHeader: the logo stops being the page's <h1>.
// Mobile README -> Regional tab — body -> About: "The title is the page's
// one h1; the logo isn't a heading." The logo stays on screen as before
// (home-header.e2e.ts pins its look); only its element changes. Desktop's
// logo was already a link, not a heading.

type MobileHeaderProps = {
	homeHref: string;
	tabs: { options: { value: string; label: string }[]; value: string; label: string };
	language: { code: string; label: string; expanded: boolean };
	search: { label: string; expanded: boolean; onclick: () => void };
};

const PROPS: MobileHeaderProps = {
	homeHref: '/en/',
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

// Clicks never navigate the test page away.
async function renderHeader(overrides: Partial<MobileHeaderProps> = {}): Promise<HTMLElement> {
	const MobileHeader = await loadHome<MobileHeaderProps>('MobileHeader');
	const target = stage('background: var(--bg-page)');
	target.addEventListener('click', (event) => event.preventDefault());
	render(MobileHeader, { target, props: { ...PROPS, ...overrides } });
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

// FE-9 FB-11 (D-FE9-7), mobile README -> Screen 1 -> Header: "Logo
// "Asadorov" — Instrument Serif 28px, ink. It links to the start page,
// `/:lang/` (Regional, nothing open), like the desktop logo; its hit area
// reaches 44px." The header takes the href the way DesktopTopBar does
// (`homeHref`, the caller passes `localizedHref('/', lang)`). Look unchanged:
// no underline, no link colour; focus shows the shared ring (layout.css
// `:focus-visible`), like every other control.

const HOME_HREFS = ['/en/', '/es/', '/ru/'];
const LOGO_FONT_PX = '28px';
const HIT_MIN_PX = 44;

type Ring = { style: string; width: string; color: string };

// Queried once the header is in (no retry), so a missing link fails at once.
function logoLink(): HTMLElement {
	const links = page.getByRole('link', { name: LOGO, exact: true }).elements();
	expect(links.length, `got ${links.length} links named "${LOGO}", want 1`).toBe(1);
	return links[0] as HTMLElement;
}

async function shownLogoLink(overrides: Partial<MobileHeaderProps> = {}): Promise<HTMLElement> {
	await renderHeader(overrides);
	await expect.element(page.getByRole('banner')).toBeInTheDocument();
	return logoLink();
}

function ringOf(el: Element): Ring {
	return {
		style: style(el, 'outline-style'),
		width: style(el, 'outline-width'),
		color: style(el, 'outline-color')
	};
}

function expectLogoLook(el: Element, when: string) {
	expect(style(el, 'font-size'), `font-size ${when}`).toBe(LOGO_FONT_PX);
	expect(style(el, 'font-weight'), `font-weight ${when}`).toBe('400');
	expect(style(el, 'font-family'), `font-family ${when}`).toBe(
		computed('font-family', 'var(--font-display)')
	);
	expect(style(el, 'color'), `color ${when}, want --ink`).toBe(computed('color', 'var(--ink)'));
	expect(style(el, 'text-decoration-line'), `underline ${when}`).toBe('none');
}

describe('MobileHeader logo link (D-FE9-7)', () => {
	useViewport(390, 844);

	for (const homeHref of HOME_HREFS) {
		it(`is a link named "${LOGO}" to homeHref ${homeHref}`, async () => {
			const link = await shownLogoLink({ homeHref });
			expect(link.tagName, 'want an <a>').toBe('A');
			expect(link.getAttribute('href'), `got href ${link.getAttribute('href')}`).toBe(homeHref);
			expect(link.textContent?.trim(), 'the logo text is never translated').toBe(LOGO);
		});
	}

	it('is not a heading and sits inside no heading', async () => {
		const link = await shownLogoLink();
		expect(link.closest('h1, h2, h3, h4, h5, h6, [role="heading"]'), 'got a heading').toBeNull();
		expect(link.getAttribute('role'), 'got a role overriding the link').toBeNull();
	});

	it(`has a hit area of at least ${HIT_MIN_PX}×${HIT_MIN_PX}px`, async () => {
		const area = hitArea(await shownLogoLink());
		expect(area.width, `got hit width ${area.width}, want ≥ ${HIT_MIN_PX}`).toBeGreaterThan(
			HIT_MIN_PX - 1
		);
		expect(area.height, `got hit height ${area.height}, want ≥ ${HIT_MIN_PX}`).toBeGreaterThan(
			HIT_MIN_PX - 1
		);
	});

	it(`keeps the logo look: --font-display ${LOGO_FONT_PX}/400 in ink, not underlined`, async () => {
		expectLogoLook(await shownLogoLink(), 'at rest');
	});

	it('keeps the logo look on hover: no underline, no colour change', async () => {
		const link = await shownLogoLink();
		await userEvent.hover(link);
		expectLogoLook(link, 'on hover');
	});

	it('shows the shared --focus-ring outline after keyboard focus', async () => {
		const target = await renderHeader();
		await expect.element(page.getByRole('banner')).toBeInTheDocument();
		const before = document.createElement('button');
		target.prepend(before);
		before.focus();
		await userEvent.tab();
		const link = logoLink();
		expect(document.activeElement, 'want Tab to land on the logo link first').toBe(link);
		const ring = ringOf(link);
		expect(ring.style, 'got no outline').not.toBe('none');
		expect(parseFloat(ring.width), `got outline width ${ring.width}`).toBeGreaterThan(0);
		const want = computed('outline-color', 'var(--focus-ring)', 'outline-style: solid');
		expect(ring.color, 'got an outline not in --focus-ring').toBe(want);
	});
});
