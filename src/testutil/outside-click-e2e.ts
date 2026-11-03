import mapGrid from '../lib/map/map-grid.json' with { type: 'json' };
import { expect, type Locator, type Page } from './e2e-test';
import { bottom, boxOf, pathAndQuery, right, visibleMap, type Box } from './home-e2e';
import { historyLength, regionLink } from './region-e2e';

// FE-9 FB-14 (D-FE9-9): on desktop a plain primary click on empty space
// (the map's gaps and sea, the page background, the about block outside its
// links) clears the selected region. These helpers pick such points from
// the live layout and check, before clicking, that the point really is
// empty, so a layout change fails here and not as a missing clear.

export type Point = { x: number; y: number };

// What a click there must never land on (D-FE9-9: "not on/inside any link,
// button, input, label, summary or other interactive element"), plus the
// top bar and the region panel.
const NOT_EMPTY = 'a, button, input, select, textarea, label, summary, header, section[aria-label]';

// Viewport px a "beside"/"below" point keeps clear of the box it is next to.
const OUTSIDE_MARGIN_PX = 12;

const centre = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

// The bottom-right sea cell of map-grid.json, in viewport px (no region and
// no hit extension is drawn there; asserted against the file).
export async function seaPoint(page: Page): Promise<Point> {
	const row = mapGrid.rows - 1;
	const col = mapGrid.columns - 1;
	expect(mapGrid.grid[row][col], 'want the map grid’s bottom-right cell to be sea').toBe(
		mapGrid.emptyCell
	);
	const map = await boxOf(visibleMap(page), 'the map');
	return {
		x: map.x + ((col + 0.5) / mapGrid.columns) * map.width,
		y: map.y + ((row + 0.5) / mapGrid.rows) * map.height
	};
}

type Rect = { top: number; left: number; right: number; width: number; height: number };

// Two cells on one row with only a map gap between them (closer than a cell
// width), or null.
function firstSideBySidePair(cells: Rect[]): [Rect, Rect] | null {
	for (const left of cells) {
		const next = cells.find(
			(b) => b.top === left.top && b.left > left.right && b.left - left.right < left.width
		);
		if (next) return [left, next];
	}
	return null;
}

// Every region's cells, in viewport px, one list per region link.
function regionCellRects(map: Locator): Promise<Rect[][]> {
	return map.evaluate((el) =>
		[...el.querySelectorAll('a')].map((region) =>
			[...region.querySelectorAll('[data-map-cell]')].map((cell) => {
				const { top, left, right, width, height } = cell.getBoundingClientRect();
				return { top, left, right, width, height };
			})
		)
	);
}

// Midway across the gap between the first two side-by-side cells of one
// region (the gap is --map-gap-desktop wide).
export async function mapGapPoint(page: Page): Promise<Point> {
	const pair = (await regionCellRects(visibleMap(page)))
		.map(firstSideBySidePair)
		.find((found) => found !== null);
	expect(pair, 'got no two side-by-side map cells to click between').toBeTruthy();
	const [left, next] = pair!;
	return { x: (left.right + next.left) / 2, y: left.top + left.height / 2 };
}

// The about block, the home's one <h1> and its paragraph.
export function aboutBlock(page: Page): Locator {
	return page
		.getByRole('main')
		.locator('section')
		.filter({ has: page.getByRole('heading', { level: 1 }) });
}

export const aboutParagraph = (page: Page): Locator => aboutBlock(page).locator('p');

// The page background in the side gutter, level with the about block.
export async function besideAboutPoint(page: Page): Promise<Point> {
	await aboutBlock(page).scrollIntoViewIfNeeded();
	const about = await boxOf(aboutBlock(page), 'the about block');
	expect(about.x, 'want a page gutter left of the about block').toBeGreaterThan(OUTSIDE_MARGIN_PX);
	return { x: about.x / 2, y: centre(about).y };
}

// The page background just below the about block, at the bottom of the page.
export async function belowAboutPoint(page: Page): Promise<Point> {
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	const about = await boxOf(aboutBlock(page), 'the about block');
	const point = { x: centre(about).x, y: bottom(about) + OUTSIDE_MARGIN_PX };
	const height = await page.evaluate(() => window.innerHeight);
	expect(point.y, 'want page background below the about block in view').toBeLessThan(height);
	return point;
}

// Inside the panel's left padding (30px), halfway down: the panel itself,
// not its content.
export async function panelPaddingPoint(panel: Locator): Promise<Point> {
	const box = await boxOf(panel, 'the region panel');
	return { x: box.x + OUTSIDE_MARGIN_PX, y: centre(box).y };
}

// The top bar between the tabs and the search field (its flexible spacer).
export async function topBarSpacerPoint(page: Page, field: Locator): Promise<Point> {
	const banner = page.getByRole('banner').filter({ visible: true });
	const tabs = await boxOf(banner.getByRole('tablist'), 'the top bar tabs');
	const search = await boxOf(field, 'the top bar search field');
	expect(search.x - right(tabs), 'want a gap between the tabs and the search').toBeGreaterThan(
		2 * OUTSIDE_MARGIN_PX
	);
	return { x: (right(tabs) + search.x) / 2, y: centre(tabs).y };
}

// What the browser hits at a point: the element's tag and whether it is
// (inside) something a clearing click must avoid.
async function hitAt(page: Page, point: Point) {
	return page.evaluate(
		({ x, y, selector }) => {
			const hit = document.elementFromPoint(x, y);
			return { tag: hit?.tagName ?? null, blocked: hit?.closest(selector)?.tagName ?? null };
		},
		{ ...point, selector: NOT_EMPTY }
	);
}

// Asserts the point is empty space, then clicks it with the primary button.
export async function clickEmptySpace(page: Page, point: Point, what: string) {
	const hit = await hitAt(page, point);
	expect(hit.tag, `got nothing at ${what}`).not.toBeNull();
	expect(hit.blocked, `got ${what} inside a <${hit.blocked}>, want empty space`).toBeNull();
	await page.mouse.click(point.x, point.y);
}

// Asserts the point is on the panel itself (its padding), then clicks it.
export async function clickPanelItself(page: Page, panel: Locator, point: Point) {
	const isPanel = await panel.evaluate(
		(el, { x, y }) => document.elementFromPoint(x, y) === el,
		point
	);
	expect(isPanel, 'want the point on the panel itself (its padding)').toBe(true);
	await page.mouse.click(point.x, point.y);
}

// Lets a click's handlers and any navigation they start run: the home's
// navigations load nothing from the server, so two frames are enough.
export async function afterFrames(page: Page) {
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
}

// Still on the region: same URL, no new history entry, region selected.
export async function expectStillSelected(page: Page, key: string, entries: number) {
	await afterFrames(page);
	expect(pathAndQuery(page), 'got the region cleared, want it kept').toBe(`/en/regions/${key}`);
	expect(await historyLength(page), 'got a navigation, want none').toBe(entries);
	await expect(regionLink(page, key)).toHaveAttribute('aria-current', 'true');
}

export async function focusedTag(page: Page): Promise<string> {
	return page.evaluate(() => document.activeElement?.tagName ?? 'none');
}

// Steps of a mouse drag, so the browser extends a text selection on the way.
const DRAG_STEPS = 10;

// Presses at `from`, drags to `to` and releases there (a text selection, or
// a press that starts somewhere a click wouldn't clear).
export async function dragBetween(page: Page, from: Point, to: Point) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
	await page.mouse.up();
}

export async function selectedText(page: Page): Promise<string> {
	return page.evaluate(() => document.getSelection()?.toString() ?? '');
}

// A point just inside the left edge of a text box, on its first line.
export async function textStartPoint(text: Locator): Promise<Point> {
	const box = await boxOf(text, 'the text');
	return { x: box.x + OUTSIDE_MARGIN_PX, y: box.y + OUTSIDE_MARGIN_PX };
}
