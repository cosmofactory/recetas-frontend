import { browser } from '$app/env';
import { onNavigate } from '$app/navigation';
import { desktopQuery } from './breakpoints.ts';
import { motionFor, prefersReducedMotion, type MotionKind } from './motion.svelte.ts';
import { pageDirection, type PageDirection, type PageNavigation } from './page-push.ts';

// Mobile README -> Screen 2/3: pages push in from the right over the one
// below. The marks on <html> select the animations in page-push.css. The
// desktop prototype swaps views in place, so ≥ 860px has no page push.

type PushNavigation = PageNavigation & { complete: Promise<void> };
type ViewTransitionMark = Exclude<PageDirection, 'none'> | 'fade';

// The root layout's page container, which the CSS fallback animates.
const APP_SHELL_CLASS = 'app-shell';

const root = () => document.documentElement;
const ignore = () => undefined;
let activeTransition: ViewTransition | undefined;
// Whether the last popstate was a back/forward gesture the browser animated
// itself (iOS edge swipe, Chrome Android back); SvelteKit doesn't pass the
// event to onNavigate.
let browserAnimatedPopstate = false;

export function pagePush(): void {
	// Capture phase, so it runs before SvelteKit's own popstate handler.
	if (browser) window.addEventListener('popstate', recordPopstate, { capture: true });
	onNavigate(startPagePush);
}

function recordPopstate(event: PopStateEvent): void {
	browserAnimatedPopstate = event.hasUAVisualTransition === true;
}

// The flag belongs to the next navigation only, whatever its type.
function takeBrowserAnimated(navigation: PushNavigation): boolean {
	const animated = browserAnimatedPopstate && navigation.type === 'popstate';
	browserAnimatedPopstate = false;
	return animated;
}

export function startPagePush(navigation: PushNavigation): Promise<void> | undefined {
	if (takeBrowserAnimated(navigation)) return undefined;
	const direction = pageDirection(navigation);
	if (direction === 'none' || matchMedia(desktopQuery).matches) return undefined;
	const motion = motionFor(prefersReducedMotion.current);
	if (!document.startViewTransition) {
		if (direction === 'push') markFallbackAfter(navigation.complete, motion);
		return undefined;
	}
	return runViewTransition(motion === 'fade' ? 'fade' : direction, navigation.complete);
}

// Resolves once the transition has captured the old page; its update then
// waits for the new page, which is what it animates to. An aborted
// navigation rejects the update and every promise derived from it.
function runViewTransition(mark: ViewTransitionMark, complete: Promise<void>): Promise<void> {
	return new Promise((captured) => {
		root().dataset.pagePush = mark;
		const transition = document.startViewTransition(async () => {
			captured();
			await complete;
		});
		activeTransition = transition;
		const clear = () => clearTransitionMark(transition);
		transition.ready.catch(ignore);
		transition.updateCallbackDone.catch(ignore);
		void transition.finished.then(clear, clear);
	});
}

// A newer transition skips this one and owns the mark from then on.
function clearTransitionMark(transition: ViewTransition): void {
	if (activeTransition !== transition) return;
	activeTransition = undefined;
	delete root().dataset.pagePush;
}

// Without the API the outgoing page is gone by the time anything can move,
// so only a push animates: the new page container slides (or fades) in.
function markFallbackAfter(complete: Promise<void>, motion: MotionKind): void {
	complete.then(() => setFallbackMark(motion), ignore);
}

// Unset, flushed and set again, so a push during a running one restarts it.
function setFallbackMark(motion: MotionKind): void {
	delete root().dataset.pagePushFallback;
	void root().offsetWidth;
	root().dataset.pagePushFallback = motion;
	document.addEventListener('animationend', clearFallbackMark);
	document.addEventListener('animationcancel', clearFallbackMark);
}

// A restart cancels the old animation while the new one runs; only the
// container's last animation ending removes the mark.
function clearFallbackMark(event: AnimationEvent): void {
	if (!(event.target instanceof Element)) return;
	if (!event.target.classList.contains(APP_SHELL_CLASS)) return;
	if (event.target.getAnimations().length > 0) return;
	delete root().dataset.pagePushFallback;
	document.removeEventListener('animationend', clearFallbackMark);
	document.removeEventListener('animationcancel', clearFallbackMark);
}
