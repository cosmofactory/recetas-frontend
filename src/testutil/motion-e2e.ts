import { expect, type Page } from '@playwright/test';
import { addInitScriptWith } from './in-page-e2e';

// Records every animation and CSS transition a page runs (Web Animations:
// CSS animations and transitions, Svelte transitions, view-transition
// pseudo-elements), sampled once a frame, so a test can tell a slide from a
// fade: a property that moves a box (transform, translate, inset, margins…)
// taking more than one value across its keyframes is a slide.

type MotionLog = { moving: string[]; fading: string[]; seen: number };

const LOG = '__motionLog';

// In-page helpers (serialised; no imports, no closures).

function restingValue(value: unknown): string {
	const identity = ['none', 'matrix(1, 0, 0, 1, 0, 0)', 'translate(0px)', '0px', 'auto'];
	return identity.includes(String(value)) ? '(rest)' : String(value);
}

function keyframeValues(animation: Animation, property: string): string[] {
	const frames = (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? [];
	const values = frames.map((frame) => frame[property]).filter((v) => v !== undefined);
	return [...new Set(values.map(restingValue))];
}

function animationLabel(animation: Animation): string {
	const effect = animation.effect as KeyframeEffect | null;
	const css = animation as Partial<CSSAnimation & CSSTransition>;
	const name = css.animationName ?? css.transitionProperty ?? (animation.id || 'script animation');
	const target = effect?.target;
	const classes = target?.getAttribute('class') ?? '';
	const where = target ? `<${target.tagName.toLowerCase()} class="${classes}">` : '?';
	return `${name} on ${where}${effect?.pseudoElement ?? ''}`;
}

function inspectAnimation(animation: Animation, log: MotionLog) {
	const moving = ['transform', 'translate', 'scale', 'rotate', 'top', 'right', 'bottom', 'left'];
	const margins = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
	for (const property of [...moving, ...margins]) {
		const values = keyframeValues(animation, property);
		if (values.length > 1)
			log.moving.push(`${animationLabel(animation)}: ${property} ${values.join(' → ')}`);
	}
	if (keyframeValues(animation, 'opacity').length > 1) log.fading.push(animationLabel(animation));
	log.seen++;
}

function sampleAnimations(log: MotionLog, counted: WeakSet<Animation>) {
	for (const animation of document.getAnimations()) {
		if (counted.has(animation)) continue;
		counted.add(animation);
		inspectAnimation(animation, log);
	}
	requestAnimationFrame(() => sampleAnimations(log, counted));
}

function startRecording(name: string) {
	const log: MotionLog = { moving: [], fading: [], seen: 0 };
	(window as unknown as Record<string, MotionLog>)[name] = log;
	sampleAnimations(log, new WeakSet());
}

export function recordAnimations(page: Page): Promise<void> {
	const helpers = [
		restingValue,
		keyframeValues,
		animationLabel,
		inspectAnimation,
		sampleAnimations
	];
	return addInitScriptWith(page, startRecording, helpers, LOG);
}

const readLog = (page: Page): Promise<MotionLog> =>
	page.evaluate((name) => (window as unknown as Record<string, MotionLog>)[name], LOG);

// Clears the log, so the next check covers only what runs from now on.
export async function resetAnimationLog(page: Page) {
	await page.evaluate((name) => {
		const log = (window as unknown as Record<string, MotionLog>)[name];
		log.moving.length = 0;
		log.fading.length = 0;
		log.seen = 0;
	}, LOG);
}

// Since the last reset: nothing slid, and something faded (the change was
// animated as a fade, not dropped). Then the log starts over.
export async function expectOnlyFades(page: Page, what: string) {
	const log = await readLog(page);
	const moves = log.moving.join('\n');
	expect(log.moving, `got movement while ${what}, want fades only:\n${moves}`).toEqual([]);
	expect(log.fading.length, `got no fade while ${what} (${log.seen} animations)`).toBeGreaterThan(
		0
	);
	await resetAnimationLog(page);
}

// The positive control: without reduced motion the same change slides, so
// the recorder does see movement.
export async function expectMovement(page: Page, what: string) {
	const log = await readLog(page);
	expect(
		log.moving.length,
		`got no movement recorded while ${what}, want the slide`
	).toBeGreaterThan(0);
	await resetAnimationLog(page);
}
