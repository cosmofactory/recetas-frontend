// Resolves true once the CSS transitions running on `el` itself (not its
// descendants) have finished, at once when none run; false when one is
// cancelled (e.g. the state flipped back mid-way).
export async function afterOwnTransitions(el: HTMLElement): Promise<boolean> {
	const running = el.getAnimations().filter((animation) => animation instanceof CSSTransition);
	const settled = await Promise.allSettled(running.map((animation) => animation.finished));
	return settled.every((result) => result.status === 'fulfilled');
}
