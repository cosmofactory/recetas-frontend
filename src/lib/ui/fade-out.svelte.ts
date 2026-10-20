import { untrack } from 'svelte';

type FadeOutOptions<T> = {
	// Where the sheet is asked to be.
	target: () => T;
	hidden: T;
	fade: () => boolean;
};

// Under reduced motion a closing sheet fades out where it rests (jumping off
// screen first would hide the fade) and moves to its hidden place once the
// opacity transition ends. `current` is the place to draw it at.
export function placeWhileFading<T>(options: FadeOutOptions<T>) {
	let place = $state(untrack(options.target));

	$effect.pre(() => {
		const target = options.target();
		if (target === options.hidden && options.fade()) return;
		place = target;
	});

	return {
		get current(): T {
			return place;
		},
		onTransitionEnd(event: TransitionEvent) {
			if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
			if (options.target() === options.hidden) place = options.hidden;
		}
	};
}
