import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { content, focusIsIn, labelled, screenFrame, settle } from '../../../testutil/sheet';
import { loadHarness, loadUi, useViewport } from '../../../testutil/ui';

// FE-3 review / QA: the Filters sheet (OverlaySheet) can open above an
// expanded home sheet (BottomSheet). One Escape closes only the top one (it
// handles the key and marks it with preventDefault, which the sheet below
// ignores); the next Escape closes the sheet below. This holds whether the
// overlay is a sibling of the sheet or rendered inside its content.

type SheetState = 'hidden' | 'peek' | 'expanded';
type OnStateChange = (next: SheetState) => void;
type Labels = { sheet: string; handle: string; overlay: string; controls: string[] };

const LABELS: Labels = {
	sheet: 'Galicia',
	handle: 'Expand',
	overlay: 'Filters',
	controls: ['Vegetarian']
};

type Stack = {
	frame: HTMLElement;
	onStateChange: ReturnType<typeof vi.fn<OnStateChange>>;
	onClose: ReturnType<typeof vi.fn<() => void>>;
	setOverlayOpen: (open: boolean) => Promise<void>;
};

async function renderSiblings(): Promise<Stack> {
	const OverlaySheet = await loadUi<Record<string, unknown>>('OverlaySheet');
	const BottomSheet = await loadUi<Record<string, unknown>>('BottomSheet');
	const frame = screenFrame();
	const onStateChange = vi.fn<OnStateChange>();
	const onClose = vi.fn<() => void>();
	const overlay = await render(OverlaySheet, {
		target: frame,
		props: {
			open: false,
			onClose,
			label: LABELS.overlay,
			children: content('<button type="button">Vegetarian</button>')
		}
	});
	await render(BottomSheet, {
		target: frame,
		props: {
			state: 'expanded',
			onStateChange,
			label: LABELS.sheet,
			handleLabel: LABELS.handle,
			children: content('<button type="button">Pulpo</button>')
		}
	});
	const setOverlayOpen = async (open: boolean) => {
		await overlay.rerender({ open });
		settle();
	};
	return { frame, onStateChange, onClose, setOverlayOpen };
}

async function renderNested(): Promise<Stack> {
	const Harness = await loadHarness<Record<string, unknown>>('NestedSheetsHarness');
	const frame = screenFrame();
	const onStateChange = vi.fn<OnStateChange>();
	const onClose = vi.fn<() => void>();
	const props = {
		sheetState: 'expanded',
		overlayOpen: false,
		onStateChange,
		onClose,
		labels: LABELS
	};
	const harness = await render(Harness, { target: frame, props });
	const setOverlayOpen = async (overlayOpen: boolean) => {
		await harness.rerender({ overlayOpen });
		settle();
	};
	return { frame, onStateChange, onClose, setOverlayOpen };
}

const LAYOUTS = [
	{ name: 'a sibling of', renderStack: renderSiblings },
	{ name: 'inside the content of', renderStack: renderNested }
];

describe('Escape with an OverlaySheet above an expanded BottomSheet', () => {
	useViewport(390, 844);

	for (const { name, renderStack } of LAYOUTS) {
		describe(`when the overlay is ${name} the sheet`, () => {
			async function openStack() {
				const stack = await renderStack();
				settle();
				const homeSheet = labelled(stack.frame, LABELS.sheet);
				await expect.poll(() => focusIsIn(homeSheet), { timeout: 1000 }).toBe(true);
				await stack.setOverlayOpen(true);
				const overlay = labelled(stack.frame, LABELS.overlay);
				await expect.poll(() => focusIsIn(overlay), { timeout: 1000 }).toBe(true);
				return stack;
			}

			it('closes only the overlay on the first Escape', async () => {
				const { onClose, onStateChange } = await openStack();
				await userEvent.keyboard('{Escape}');
				expect(onClose, 'want one onClose call').toHaveBeenCalledTimes(1);
				expect(onStateChange, 'got the sheet below closing too').not.toHaveBeenCalled();
			});

			it('closes the sheet on the next Escape, once the overlay is closed', async () => {
				const { onClose, onStateChange, setOverlayOpen } = await openStack();
				await userEvent.keyboard('{Escape}');
				await setOverlayOpen(false);
				await userEvent.keyboard('{Escape}');
				expect(onClose, 'want still one onClose call').toHaveBeenCalledTimes(1);
				expect(onStateChange.mock.calls).toEqual([['hidden']]);
			});
		});
	}
});

// Review: the overlay's focus trap sits inside the sheet's. The inner trap
// wraps Tab and marks the key handled (preventDefault); the outer one must
// then leave it alone, or it moves focus out of the overlay (to the sheet's
// handle) when the overlay's last control is also the sheet's last.
describe('Tab with an OverlaySheet nested inside an expanded BottomSheet', () => {
	useViewport(390, 844);

	async function openNested(controls: string[]) {
		const Harness = await loadHarness<Record<string, unknown>>('NestedSheetsHarness');
		const frame = screenFrame();
		const labels = { ...LABELS, controls };
		const props = {
			sheetState: 'expanded',
			overlayOpen: false,
			onStateChange: () => {},
			onClose: () => {},
			labels
		};
		const harness = await render(Harness, { target: frame, props });
		settle();
		await harness.rerender({ overlayOpen: true });
		settle();
		const overlay = labelled(frame, LABELS.overlay);
		await expect.poll(() => focusIsIn(overlay), { timeout: 1000 }).toBe(true);
		const button = (name: string) =>
			page.elementLocator(overlay).getByRole('button', { name, exact: true }).element();
		return { first: button(controls[0]), last: button(controls[controls.length - 1]) };
	}

	it("moves Tab from the overlay's last control to its first", async () => {
		const { first, last } = await openNested(['Vegetarian', 'Seafood']);
		last.focus();
		await userEvent.tab();
		expect(document.activeElement, 'want Tab to wrap inside the overlay').toBe(first);
	});

	it("moves Shift+Tab from the overlay's first control to its last", async () => {
		const { first, last } = await openNested(['Vegetarian', 'Seafood']);
		first.focus();
		await userEvent.tab({ shift: true });
		expect(document.activeElement, 'want Shift+Tab to wrap inside the overlay').toBe(last);
	});

	// One control: it is both the overlay's last and the sheet's last.
	it('keeps Tab on the only overlay control, the last in the sheet too', async () => {
		const { first } = await openNested(['Vegetarian']);
		first.focus();
		await userEvent.tab();
		expect(document.activeElement, 'got Tab leaving the overlay').toBe(first);
	});
});
