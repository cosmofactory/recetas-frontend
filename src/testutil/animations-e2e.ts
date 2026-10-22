import { expect, type Locator } from '@playwright/test';

// Whether no animation or CSS transition is still running on the element:
// geometry read after this is its resting layout, not a frame of a slide.
export function animationsSettled(locator: Locator): Promise<boolean> {
	return locator.evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running'));
}

export async function expectAnimationsSettled(locator: Locator, what: string) {
	await expect
		.poll(() => animationsSettled(locator), { message: `want ${what} at rest` })
		.toBe(true);
}
