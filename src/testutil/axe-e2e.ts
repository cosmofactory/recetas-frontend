import { expect, type Page } from '@playwright/test';

// axe for the Playwright specs (stack.md X10: WCAG 2.2 AA, checked with
// @axe-core/playwright, pinned ~4.13.0, a dev dependency). The module is
// loaded at run time, so a missing package fails as an assertion naming it.

const AXE_MODULE = '@axe-core/playwright';
export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export type Violation = {
	id: string;
	impact?: string | null;
	help: string;
	nodes: { target: unknown; html: string }[];
};
type AxeBuilder = {
	withTags(tags: string[]): AxeBuilder;
	withRules(rules: string[]): AxeBuilder;
	analyze(): Promise<{ violations: Violation[]; incomplete: Violation[] }>;
};
type AxeBuilderClass = new (options: { page: Page }) => AxeBuilder;

export async function loadAxe(): Promise<AxeBuilderClass> {
	let mod: { default?: AxeBuilderClass } = {};
	let loadError = '';
	try {
		mod = (await import(/* @vite-ignore */ AXE_MODULE)) as { default?: AxeBuilderClass };
	} catch (err) {
		loadError = String(err);
	}
	expect(mod.default, `install ${AXE_MODULE} ~4.13.0 (devDependency): ${loadError}`).toBeDefined();
	return mod.default!;
}

export function summary(violations: Violation[]): string {
	return violations
		.map(
			(v) =>
				`${v.id} (${v.impact ?? 'n/a'}): ${v.help} at ${JSON.stringify(v.nodes.map((n) => n.target))}`
		)
		.join('\n');
}

// Best-practice landmark rules (FE-4 PR 3 review): one <main>, and all page
// content inside some landmark.
const LANDMARK_RULES = ['landmark-one-main', 'region'];

export async function expectNoViolations(page: Page, what: string) {
	const Axe = await loadAxe();
	const { violations } = await new Axe({ page }).withTags(WCAG_AA_TAGS).analyze();
	expect(violations, `got axe violations on ${what}:\n${summary(violations)}`).toEqual([]);
	const landmarks = (await new Axe({ page }).withRules(LANDMARK_RULES).analyze()).violations;
	expect(landmarks, `got landmark violations on ${what}:\n${summary(landmarks)}`).toEqual([]);
}
