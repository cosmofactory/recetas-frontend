import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { page } from 'vitest/browser';
import {
	deferred,
	navigation,
	type FakeNavigation,
	type NavigationSpec
} from '../../testutil/navigation';
import { settle } from '../../testutil/sheet';
import {
	computed,
	emulateReducedMotion,
	loadUiExport,
	resetEmulatedMedia,
	stage,
	useViewport
} from '../../testutil/ui';

// FE-3 PagePush (src/lib/ui/page-push.svelte.ts + src/lib/styles/page-push.css).
// Mobile README -> Screen 2: the Variations page "pushes in from the right
// over the home (translateX 102% → 0, 420ms `--ease`, shadow
// `--shadow-page-push`)"; Screen 3: the Recipe page "pushes in over the
// Variations page with the same transition". Prototype (DishVariations.dc.html
// recipeStyle, Asadorov Explorations.dc.html pageStyle): the page under it
// stays where it is; going back slides the top page out to 102% again.
// Stage FE-3: "Built on SvelteKit onNavigate + the View Transitions API, with
// a CSS fallback". Accessibility: reduced motion swaps slides for fades.
//
// The contract pinned here:
// - pagePush() registers one onNavigate callback; startPagePush(navigation)
//   is that callback, so it is tested without a router.
// - With document.startViewTransition, a push or pop (pageDirection) starts
//   one view transition, marking <html data-page-push="push|pop"> while it
//   runs ("fade" under reduced motion; the crossfade has no transform). The
//   callback's promise resolves once the transition has captured the old page
//   (its update has started), and the update waits for navigation.complete,
//   so the new page is what the transition animates to. The mark goes when
//   the transition finishes.
// - Desktop (≥ 860px) has no page push: the desktop prototype swaps views in
//   place, and its README describes no transition (assumption: none at all).
// - Without the View Transitions API (the CSS fallback, decided here): the
//   navigation is not held; once it completes, <html
//   data-page-push-fallback="slide"> (or "fade" under reduced motion) makes
//   the incoming page container, the root layout's `.app-shell`, animate in
//   with the same keyframes; the mark goes when that animation ends. A pop
//   has no fallback animation: the outgoing page is already gone, so the
//   page under it simply shows.

type Direction = 'push' | 'pop' | 'none';
type StartPagePush = (navigation: FakeNavigation) => Promise<void> | undefined;

const MODULE = 'page-push.svelte.ts';

const onNavigate = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ onNavigate }));

// The transition styles, as the root layout loads them (a glob, so a
// not-yet-written file leaves the rules unset instead of failing the import).
import.meta.glob('../styles/page-push.css', { eager: true });

const HOME = '/en/';
const DISH = '/en/dishes/tortilla';
const RECIPE = '/en/dishes/tortilla/gal';

const PUSH: NavigationSpec = { from: HOME, to: DISH };
const POP: NavigationSpec = { from: RECIPE, to: DISH };

const startPagePush = () => loadUiExport<StartPagePush>(MODULE, 'startPagePush');
const root = document.documentElement;

afterEach(async () => {
	await resetEmulatedMedia();
	delete root.dataset.pagePush;
	delete root.dataset.pagePushFallback;
});

// Whether `promise` is still pending once the current task's microtasks ran.
async function isPending(promise: Promise<unknown>): Promise<boolean> {
	const nextTask = new Promise((resolve) => setTimeout(() => resolve('pending'), 0));
	return (await Promise.race([promise.then(() => 'settled'), nextTask])) === 'pending';
}

type StartArgument = Parameters<Document['startViewTransition']>[0];
type Started = { update: () => unknown; mark: string | undefined; finish: () => void };

function updateOf(arg: StartArgument): () => unknown {
	if (typeof arg === 'function') return arg;
	return arg?.update ?? (() => undefined);
}

// A stand-in for document.startViewTransition that records each call (its
// update callback and the <html data-page-push> mark at that moment) and
// lets the test run the update and finish the transition.
function fakeViewTransitions() {
	const started: Started[] = [];
	const start = vi.fn((arg: StartArgument) => {
		const finished = deferred();
		started.push({ update: updateOf(arg), mark: root.dataset.pagePush, finish: finished.resolve });
		const done = Promise.resolve();
		return {
			finished: finished.promise,
			ready: done,
			updateCallbackDone: done,
			skipTransition: finished.resolve
		};
	});
	Object.defineProperty(document, 'startViewTransition', {
		value: start,
		configurable: true,
		writable: true
	});
	onTestFinished(() => void Reflect.deleteProperty(document, 'startViewTransition'));
	return { start, started };
}

// A browser without the API: not even the property exists.
function withoutViewTransitions() {
	const native = Object.getOwnPropertyDescriptor(Document.prototype, 'startViewTransition');
	Reflect.deleteProperty(Document.prototype, 'startViewTransition');
	onTestFinished(() => {
		if (native) Object.defineProperty(Document.prototype, 'startViewTransition', native);
	});
}

describe('startPagePush with the View Transitions API', () => {
	useViewport(390, 844);

	const directions: { name: string; spec: NavigationSpec; mark: Exclude<Direction, 'none'> }[] = [
		{ name: 'push (home → variations)', spec: PUSH, mark: 'push' },
		{ name: 'push (variations → recipe)', spec: { from: DISH, to: RECIPE }, mark: 'push' },
		{ name: 'pop (recipe → variations)', spec: POP, mark: 'pop' },
		{
			name: 'pop (back button to home)',
			spec: { type: 'popstate', delta: -1, from: DISH, to: HOME },
			mark: 'pop'
		}
	];
	for (const { name, spec, mark } of directions) {
		it(`starts one view transition marked data-page-push="${mark}" for a ${name}`, async () => {
			const { start, started } = fakeViewTransitions();
			void (await startPagePush())(navigation(spec));
			expect(start, 'want one startViewTransition call').toHaveBeenCalledTimes(1);
			expect(started[0].mark, `got data-page-push="${started[0].mark}"`).toBe(mark);
		});
	}

	for (const spec of [PUSH, POP]) {
		it(`marks a ${spec === PUSH ? 'push' : 'pop'} data-page-push="fade" under reduced motion`, async () => {
			await emulateReducedMotion('reduce');
			const { start, started } = fakeViewTransitions();
			void (await startPagePush())(navigation(spec));
			expect(start, 'want one startViewTransition call').toHaveBeenCalledTimes(1);
			expect(started[0].mark, `got data-page-push="${started[0].mark}"`).toBe('fade');
		});
	}

	it('holds the navigation until the transition has captured the old page', async () => {
		const { started } = fakeViewTransitions();
		const held = (await startPagePush())(navigation(PUSH));
		expect(held, 'want a promise that holds the navigation').toBeInstanceOf(Promise);
		expect(await isPending(held!), 'got the navigation released before the update ran').toBe(true);
		void started[0].update();
		expect(await isPending(held!), 'got the navigation still held once the update ran').toBe(false);
	});

	it('keeps the transition update pending until the navigation completes', async () => {
		const { started } = fakeViewTransitions();
		const complete = deferred();
		void (await startPagePush())(navigation({ ...PUSH, complete: complete.promise }));
		const update = Promise.resolve(started[0].update());
		expect(await isPending(update), 'got the update done before the new page rendered').toBe(true);
		complete.resolve();
		expect(await isPending(update), 'got the update still pending after completion').toBe(false);
	});

	it('removes data-page-push once the transition finishes', async () => {
		const { started } = fakeViewTransitions();
		void (await startPagePush())(navigation(PUSH));
		await started[0].update();
		expect(root.dataset.pagePush, 'want the mark while the transition runs').toBe('push');
		started[0].finish();
		await expect.poll(() => root.dataset.pagePush, { timeout: 1000 }).toBeUndefined();
	});

	const still: { name: string; spec: NavigationSpec }[] = [
		{ name: 'the initial load', spec: { type: 'enter', from: null, to: DISH } },
		{ name: 'a locale-only switch', spec: { from: DISH, to: '/ru/dishes/tortilla' } },
		{ name: 'a query-only change', spec: { from: HOME, to: '/en/?tab=popular' } },
		{ name: 'home → region', spec: { from: HOME, to: '/en/regions/gal' } },
		{ name: 'one dish → another', spec: { from: DISH, to: '/en/dishes/paella' } }
	];
	for (const { name, spec } of still) {
		it(`starts no transition and holds nothing for ${name}`, async () => {
			const { start } = fakeViewTransitions();
			const held = (await startPagePush())(navigation(spec));
			expect(held, 'got the navigation held').toBeUndefined();
			expect(start, 'got a view transition').not.toHaveBeenCalled();
			expect(root.dataset.pagePush, 'got a data-page-push mark').toBeUndefined();
		});
	}
});

describe('startPagePush on desktop', () => {
	useViewport(1280, 800);

	for (const spec of [PUSH, POP]) {
		it(`starts no transition for a ${spec === PUSH ? 'push' : 'pop'} at 1280px`, async () => {
			const { start } = fakeViewTransitions();
			const held = (await startPagePush())(navigation(spec));
			expect(held, 'got the navigation held on desktop').toBeUndefined();
			expect(start, 'got a view transition on desktop').not.toHaveBeenCalled();
		});
	}
});

describe('pagePush', () => {
	it('registers one onNavigate callback that runs the page push', async () => {
		const pagePush = await loadUiExport<() => void>(MODULE, 'pagePush');
		onNavigate.mockClear();
		pagePush();
		expect(onNavigate, 'want one onNavigate registration').toHaveBeenCalledTimes(1);
		const callback = onNavigate.mock.calls[0][0] as StartPagePush;
		const { start } = fakeViewTransitions();
		void callback(navigation(PUSH));
		expect(start, 'want the registered callback to start the push').toHaveBeenCalledTimes(1);
	});
});

// The real API in Chromium: the styles behind the marks, read from the
// running transition's animations.

type PseudoAnimation = { pseudo: string; frames: ComputedKeyframe[]; duration: unknown };

const IDENTITY = /^(none|matrix\(1, 0, 0, 1, 0, 0\)|translateX\(0(px|%)?\))$/;
const OFF_RIGHT = 'translateX(102%)';

function viewTransitionAnimations(part: 'old' | 'new'): PseudoAnimation[] {
	return root.getAnimations({ subtree: true }).flatMap((animation) => {
		const effect = animation.effect;
		if (!(effect instanceof KeyframeEffect)) return [];
		const pseudo = effect.pseudoElement ?? '';
		if (!pseudo.startsWith(`::view-transition-${part}(`)) return [];
		const duration = effect.getComputedTiming().duration;
		return [{ pseudo, frames: effect.getKeyframes(), duration }];
	});
}

function transforms(animation: PseudoAnimation): string[] {
	return animation.frames.flatMap((frame) => (frame.transform ? [String(frame.transform)] : []));
}

function movesAcross(animation: PseudoAnimation): boolean {
	return transforms(animation).some((transform) => !IDENTITY.test(transform));
}

function fades(animation: PseudoAnimation): boolean {
	const opacities = animation.frames.flatMap((frame) =>
		frame.opacity === undefined ? [] : [String(frame.opacity)]
	);
	return new Set(opacities).size > 1;
}

// The animation sliding a page between `from` and `to` (one of them off to
// the right), on the old or new snapshot.
function slide(part: 'old' | 'new', from: 'in' | 'out'): PseudoAnimation | undefined {
	return viewTransitionAnimations(part).find((animation) => {
		const list = transforms(animation);
		const [first, last] = [list[0] ?? '', list.at(-1) ?? ''];
		return from === 'in'
			? first === OFF_RIGHT && IDENTITY.test(last)
			: IDENTITY.test(first) && last === OFF_RIGHT;
	});
}

// The pseudo with the same view-transition-name on the other side.
function counterpart(pseudo: string, part: 'old' | 'new'): string {
	return pseudo.replace(/::view-transition-(old|new)\(/, `::view-transition-${part}(`);
}

function pseudoStyle(pseudo: string): CSSStyleDeclaration {
	return getComputedStyle(root, pseudo);
}

function zIndex(pseudo: string): number {
	const value = pseudoStyle(pseudo).zIndex;
	return value === 'auto' ? 0 : Number(value);
}

const durationMs = () => parseFloat(computed('animation-duration', 'var(--dur-page)')) * 1000;
const ease = () => computed('animation-timing-function', 'var(--ease)');
const pushShadow = () => computed('box-shadow', 'var(--shadow-page-push)');

// Runs startPagePush through the native API and waits until its animations
// run; the transition is skipped when the test ends.
async function runTransition(spec: NavigationSpec): Promise<void> {
	stage().classList.add('app-shell');
	const native = Document.prototype.startViewTransition;
	let transition: ViewTransition | undefined;
	const capture = (arg: StartArgument) => (transition = native.call(document, arg));
	Object.defineProperty(document, 'startViewTransition', {
		value: capture,
		configurable: true,
		writable: true
	});
	onTestFinished(() => void Reflect.deleteProperty(document, 'startViewTransition'));
	await (
		await startPagePush()
	)(navigation(spec));
	expect(transition, 'want a view transition').toBeDefined();
	onTestFinished(() => {
		transition!.skipTransition();
		return transition!.finished;
	});
	await transition!.ready;
}

describe('page push animation (View Transitions)', () => {
	useViewport(390, 844);

	it('slides the new page in from translateX(102%) to 0', async () => {
		await runTransition(PUSH);
		expect(slide('new', 'in'), 'want the new page sliding in from 102%').toBeDefined();
	});

	it('runs the push over --dur-page with --ease', async () => {
		await runTransition(PUSH);
		const animation = slide('new', 'in');
		expect(animation, 'want the new page sliding in').toBeDefined();
		expect(animation!.duration, 'got another duration').toBe(durationMs());
		expect(animation!.frames[0].easing, 'got another timing function').toBe(ease());
	});

	it('casts --shadow-page-push from the incoming page', async () => {
		await runTransition(PUSH);
		const animation = slide('new', 'in');
		expect(animation, 'want the new page sliding in').toBeDefined();
		expect(pseudoStyle(animation!.pseudo).boxShadow).toBe(pushShadow());
	});

	it('keeps the page underneath still and opaque, and the incoming page opaque', async () => {
		await runTransition(PUSH);
		const animation = slide('new', 'in');
		expect(animation, 'want the new page sliding in').toBeDefined();
		const under = viewTransitionAnimations('old').filter(
			(a) => a.pseudo === counterpart(animation!.pseudo, 'old')
		);
		expect(under.some(movesAcross), 'got the page underneath moving').toBe(false);
		expect(under.some(fades), 'got the page underneath fading').toBe(false);
		const incoming = viewTransitionAnimations('new').filter((a) => a.pseudo === animation!.pseudo);
		expect(incoming.some(fades), 'got the incoming page fading').toBe(false);
	});

	it('slides the old page out to translateX(102%) on a pop, over --dur-page with --ease', async () => {
		await runTransition(POP);
		const animation = slide('old', 'out');
		expect(animation, 'want the old page sliding out to 102%').toBeDefined();
		expect(animation!.duration, 'got another duration').toBe(durationMs());
		expect(animation!.frames[0].easing, 'got another timing function').toBe(ease());
	});

	it('keeps the leaving page above the revealed one, with the push shadow, on a pop', async () => {
		await runTransition(POP);
		const animation = slide('old', 'out');
		expect(animation, 'want the old page sliding out').toBeDefined();
		const revealed = counterpart(animation!.pseudo, 'new');
		expect(
			zIndex(animation!.pseudo),
			'got the leaving page under the revealed one'
		).toBeGreaterThan(zIndex(revealed));
		expect(pseudoStyle(animation!.pseudo).boxShadow).toBe(pushShadow());
		const under = viewTransitionAnimations('new').filter((a) => a.pseudo === revealed);
		expect(under.some(movesAcross) || under.some(fades), 'got the revealed page animating').toBe(
			false
		);
	});

	for (const spec of [PUSH, POP]) {
		it(`only crossfades a ${spec === PUSH ? 'push' : 'pop'} under reduced motion`, async () => {
			await emulateReducedMotion('reduce');
			await runTransition(spec);
			const snapshots = [...viewTransitionAnimations('old'), ...viewTransitionAnimations('new')];
			const moving = snapshots.filter(movesAcross).map((a) => a.pseudo);
			expect(moving, `got transforms on ${moving.join(', ')}`).toEqual([]);
			expect(snapshots.some(fades), 'want a crossfade').toBe(true);
		});
	}
});

describe('startPagePush without the View Transitions API (CSS fallback)', () => {
	useViewport(390, 844);

	it('does not hold the navigation', async () => {
		withoutViewTransitions();
		const held = (await startPagePush())(navigation(PUSH));
		expect(held, 'got the navigation held').toBeUndefined();
	});

	it('marks data-page-push-fallback="slide" once a push completes', async () => {
		withoutViewTransitions();
		const complete = deferred();
		void (await startPagePush())(navigation({ ...PUSH, complete: complete.promise }));
		expect(
			root.dataset.pagePushFallback,
			'got the mark before the new page rendered'
		).toBeUndefined();
		complete.resolve();
		await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBe('slide');
	});

	it('marks data-page-push-fallback="fade" for a push under reduced motion', async () => {
		await emulateReducedMotion('reduce');
		withoutViewTransitions();
		void (await startPagePush())(navigation(PUSH));
		await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBe('fade');
	});

	const unmarked: { name: string; spec: NavigationSpec }[] = [
		{ name: 'a pop', spec: POP },
		{ name: 'a locale-only switch', spec: { from: DISH, to: '/es/dishes/tortilla' } },
		{ name: 'a query-only change', spec: { from: HOME, to: '/en/?tab=popular' } }
	];
	for (const { name, spec } of unmarked) {
		it(`leaves ${name} unanimated`, async () => {
			withoutViewTransitions();
			const nav = navigation(spec);
			void (await startPagePush())(nav);
			await nav.complete;
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(root.dataset.pagePushFallback, 'got a fallback mark').toBeUndefined();
		});
	}

	it('removes the mark once the page container’s animation ends', async () => {
		stage().classList.add('app-shell');
		withoutViewTransitions();
		void (await startPagePush())(navigation(PUSH));
		await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBe('slide');
		settle();
		await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBeUndefined();
	});
});

describe('page-push.css fallback animation on .app-shell', () => {
	useViewport(390, 844);

	function shellAnimation(mark: 'slide' | 'fade') {
		const shell = stage();
		shell.classList.add('app-shell');
		root.dataset.pagePushFallback = mark;
		const animation = shell.getAnimations()[0];
		expect(
			animation,
			`want .app-shell animated under data-page-push-fallback="${mark}"`
		).toBeDefined();
		const effect = animation.effect as KeyframeEffect;
		return { frames: effect.getKeyframes(), duration: effect.getComputedTiming().duration };
	}

	it('slides the page container in from translateX(102%) over --dur-page with --ease', () => {
		const { frames, duration } = shellAnimation('slide');
		const list = frames.flatMap((frame) => (frame.transform ? [String(frame.transform)] : []));
		expect(list[0], 'want the container starting at 102%').toBe(OFF_RIGHT);
		expect(list.at(-1), `got it ending at ${list.at(-1)}`).toMatch(IDENTITY);
		expect(duration).toBe(durationMs());
		expect(frames[0].easing, 'got another timing function').toBe(ease());
	});

	it('only fades the page container in under the "fade" mark', () => {
		const { frames } = shellAnimation('fade');
		const moving = frames.some(
			(frame) => frame.transform && !IDENTITY.test(String(frame.transform))
		);
		expect(moving, 'got a transform in the fade').toBe(false);
		expect(frames[0].opacity, 'want the container starting transparent').toBe('0');
		expect(frames.at(-1)?.opacity, 'want it ending opaque').toBe('1');
	});
});

// Review follow-ups (FE-3 PR 3): overlapping navigations, aborted ones, and
// back/forward gestures the browser animates itself.

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

// Every unhandled promise rejection until the test ends (kept off the console).
function recordUnhandledRejections(): unknown[] {
	const unhandled: unknown[] = [];
	const record = (event: PromiseRejectionEvent) => {
		unhandled.push(event.reason);
		event.preventDefault();
	};
	window.addEventListener('unhandledrejection', record);
	onTestFinished(() => window.removeEventListener('unhandledrejection', record));
	return unhandled;
}

describe('startPagePush with overlapping or aborted navigations', () => {
	useViewport(390, 844);

	// A newer transition skips the older one; the older one finishing must
	// not strip the mark the newer one still needs.
	it('keeps the newer mark when an older transition finishes', async () => {
		const { started } = fakeViewTransitions();
		const start = await startPagePush();
		void start(navigation(PUSH));
		void start(navigation(POP));
		expect(started.length, 'want two transitions').toBe(2);
		started[0].finish();
		await nextTask();
		expect(root.dataset.pagePush, 'got the newer mark cleared by the older').toBe('pop');
		started[1].finish();
		await expect.poll(() => root.dataset.pagePush, { timeout: 1000 }).toBeUndefined();
	});

	// "navigation aborted": SvelteKit rejects navigation.complete. With the
	// native API the update then rejects, and so do ready, updateCallbackDone
	// and finished; none of that may surface as an unhandled rejection.
	it('removes the mark, with no unhandled rejection, when the navigation is aborted', async () => {
		const unhandled = recordUnhandledRejections();
		const aborted = Promise.reject(new Error('navigation aborted'));
		aborted.catch(() => undefined);
		void (await startPagePush())(navigation({ ...PUSH, complete: aborted }));
		await expect.poll(() => root.dataset.pagePush, { timeout: 1000 }).toBeUndefined();
		await nextTask();
		await nextTask();
		expect(unhandled.map(String), 'got unhandled rejections').toEqual([]);
	});

	it('adds no fallback mark, and no unhandled rejection, when an aborted push has no API', async () => {
		withoutViewTransitions();
		const unhandled = recordUnhandledRejections();
		const aborted = Promise.reject(new Error('navigation aborted'));
		aborted.catch(() => undefined);
		void (await startPagePush())(navigation({ ...PUSH, complete: aborted }));
		await nextTask();
		await nextTask();
		expect(root.dataset.pagePushFallback, 'got a fallback mark').toBeUndefined();
		expect(unhandled.map(String), 'got unhandled rejections').toEqual([]);
	});
});

// FE-6 PR 2 review: a push whose view transition has not run its update yet
// (the old page isn't captured) is superseded by a newer navigation B. When
// A's update finally runs it must not capture or release A: A's navigation
// stays held (SvelteKit has moved on to B), B runs as it would alone, and
// nothing surfaces as an unhandled rejection. Regression guard.
// Runs a transition's update the way the browser would: its rejection, if
// any, is the transition's to handle (ready / updateCallbackDone / finished).
async function runUpdate(started: Started) {
	await Promise.resolve()
		.then(started.update)
		.catch(() => undefined);
}

describe('startPagePush when a newer navigation supersedes a pending push', () => {
	useViewport(390, 844);

	it('B with a transition (pop): A stays held, B captures and is released', async () => {
		const unhandled = recordUnhandledRejections();
		const { started } = fakeViewTransitions();
		const start = await startPagePush();
		const heldA = start(navigation(PUSH));
		const heldB = start(navigation(POP));
		expect(started.length, 'want a transition for A and one for B').toBe(2);
		await runUpdate(started[0]);
		expect(await isPending(heldA!), 'got the superseded push released').toBe(true);
		expect(heldB, 'want B held until its own capture').toBeInstanceOf(Promise);
		void started[1].update();
		expect(await isPending(heldB!), 'got B still held after its update ran').toBe(false);
		expect(root.dataset.pagePush, 'want B to own the mark').toBe('pop');
		await nextTask();
		expect(unhandled.map(String), 'got unhandled rejections').toEqual([]);
	});

	it('B with no transition (one dish → another): A stays held, B is not held', async () => {
		const unhandled = recordUnhandledRejections();
		const { started } = fakeViewTransitions();
		const start = await startPagePush();
		const heldA = start(navigation(PUSH));
		const heldB = start(navigation({ from: DISH, to: '/en/dishes/paella' }));
		expect(heldB, 'got B held though it has no transition').toBeUndefined();
		expect(started.length, 'want no transition for B').toBe(1);
		await runUpdate(started[0]);
		expect(await isPending(heldA!), 'got the superseded push released').toBe(true);
		await nextTask();
		expect(unhandled.map(String), 'got unhandled rejections').toEqual([]);
	});

	it('B at 1280px (no page push): A stays held, B is not held', async () => {
		const unhandled = recordUnhandledRejections();
		const { started } = fakeViewTransitions();
		const start = await startPagePush();
		const heldA = start(navigation(PUSH));
		await page.viewport(1280, 800);
		const heldB = start(navigation(POP));
		expect(heldB, 'got B held on desktop').toBeUndefined();
		await runUpdate(started[0]);
		expect(await isPending(heldA!), 'got the superseded push released').toBe(true);
		await nextTask();
		expect(unhandled.map(String), 'got unhandled rejections').toEqual([]);
	});
});

describe('CSS fallback with back-to-back pushes', () => {
	useViewport(390, 844);

	function appShell(): HTMLElement {
		const shell = stage();
		shell.classList.add('app-shell');
		return shell;
	}

	function countEvents(el: HTMLElement, type: 'animationstart' | 'animationcancel') {
		const seen = { count: 0 };
		el.addEventListener(type, () => seen.count++);
		return seen;
	}

	// Runs `push` and waits for the container's animation to start (only a
	// started animation reports animationcancel), then pauses it, so it is
	// still running whenever the second push lands.
	async function pushAndHold(shell: HTMLElement, push: () => void): Promise<Animation> {
		const started = new Promise((resolve) =>
			shell.addEventListener('animationstart', resolve, { once: true })
		);
		push();
		await started;
		const animation = shell.getAnimations()[0];
		expect(animation, 'want the first animation running').toBeDefined();
		animation.pause();
		return animation;
	}

	it('restarts the slide when a second push lands during the first', async () => {
		const shell = appShell();
		withoutViewTransitions();
		const starts = countEvents(shell, 'animationstart');
		const start = await startPagePush();
		const first = await pushAndHold(shell, () => void start(navigation(PUSH)));
		void start(navigation({ from: DISH, to: RECIPE }));
		const restarted = () => {
			const current = shell.getAnimations()[0];
			return current !== undefined && current !== first;
		};
		await expect
			.poll(restarted, { timeout: 1000, message: 'want a new slide animation' })
			.toBe(true);
		expect(root.dataset.pagePushFallback).toBe('slide');
		await expect.poll(() => starts.count, { timeout: 1000 }).toBe(2);
	});

	const switches = [
		{ from: 'reduce', first: 'fade', to: 'no-preference', second: 'slide' },
		{ from: 'no-preference', first: 'slide', to: 'reduce', second: 'fade' }
	] as const;
	for (const { from, first, to, second } of switches) {
		it(`keeps the "${second}" mark through the cancelled "${first}" animation`, async () => {
			const shell = appShell();
			withoutViewTransitions();
			const cancels = countEvents(shell, 'animationcancel');
			const start = await startPagePush();
			await emulateReducedMotion(from);
			await pushAndHold(shell, () => void start(navigation(PUSH)));
			expect(root.dataset.pagePushFallback).toBe(first);
			await emulateReducedMotion(to);
			void start(navigation({ from: DISH, to: RECIPE }));
			await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBe(second);
			await expect.poll(() => cancels.count, { timeout: 1000 }).toBeGreaterThan(0);
			await nextTask();
			expect(root.dataset.pagePushFallback, 'got the new mark cleared by the old cancel').toBe(
				second
			);
			settle();
			await expect.poll(() => root.dataset.pagePushFallback, { timeout: 1000 }).toBeUndefined();
		});
	}
});

// iOS Safari's edge swipe and Chrome Android's back gesture animate the
// history move themselves and report it as PopStateEvent.hasUAVisualTransition.
// A second, app-drawn push or pop on top would animate the page twice, so
// that navigation gets none. SvelteKit doesn't pass the PopStateEvent to
// onNavigate: pagePush() records the flag with a capture-phase popstate
// listener on window, for the next navigation only.
describe('pagePush after a browser-animated back/forward gesture', () => {
	useViewport(390, 844);

	const BACK: NavigationSpec = { type: 'popstate', delta: -1, from: RECIPE, to: DISH };
	const FORWARD: NavigationSpec = { type: 'popstate', delta: 1, from: DISH, to: RECIPE };

	async function registeredCallback(): Promise<StartPagePush> {
		const pagePush = await loadUiExport<() => void>(MODULE, 'pagePush');
		onNavigate.mockClear();
		pagePush();
		expect(onNavigate, 'want one onNavigate registration').toHaveBeenCalledTimes(1);
		return onNavigate.mock.calls[0][0] as StartPagePush;
	}

	// A popstate as the browser fires it; `undefined` leaves the native value.
	function popState(hasUAVisualTransition: boolean | undefined) {
		const event = new PopStateEvent('popstate', { state: null });
		if (hasUAVisualTransition !== undefined)
			Object.defineProperty(event, 'hasUAVisualTransition', { value: hasUAVisualTransition });
		window.dispatchEvent(event);
	}

	for (const { name, spec } of [
		{ name: 'back (pop)', spec: BACK },
		{ name: 'forward (push)', spec: FORWARD }
	]) {
		it(`runs no page push for a ${name} the browser already animated`, async () => {
			const callback = await registeredCallback();
			const { start } = fakeViewTransitions();
			popState(true);
			const held = callback(navigation(spec));
			expect(held, 'got the navigation held').toBeUndefined();
			expect(start, 'got a view transition on top of the browser’s').not.toHaveBeenCalled();
			expect(root.dataset.pagePush, 'got a data-page-push mark').toBeUndefined();
		});
	}

	it('adds no fallback slide for a forward push the browser already animated', async () => {
		const callback = await registeredCallback();
		withoutViewTransitions();
		popState(true);
		const nav = navigation(FORWARD);
		void callback(nav);
		await nav.complete;
		await nextTask();
		expect(root.dataset.pagePushFallback, 'got a fallback mark').toBeUndefined();
	});

	for (const flag of [false, undefined]) {
		it(`pops as usual when hasUAVisualTransition is ${flag === false ? 'false' : 'left native'}`, async () => {
			const callback = await registeredCallback();
			const { start, started } = fakeViewTransitions();
			popState(flag);
			void callback(navigation(BACK));
			expect(start, 'want the app’s pop').toHaveBeenCalledTimes(1);
			expect(started[0].mark).toBe('pop');
		});
	}

	it('skips only the one navigation the browser animated', async () => {
		const callback = await registeredCallback();
		const { start, started } = fakeViewTransitions();
		popState(true);
		void callback(navigation(BACK));
		expect(start, 'got a transition for the browser-animated back').not.toHaveBeenCalled();
		void callback(navigation({ type: 'popstate', delta: -1, from: DISH, to: HOME }));
		expect(start, 'want the next back animated by the app').toHaveBeenCalledTimes(1);
		expect(started[0].mark).toBe('pop');
	});
});
