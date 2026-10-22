import type { ConsoleMessage, Page } from '@playwright/test';

// Collects Content-Security-Policy violations on a page (FE-8 acceptance: "no
// CSP violations across the e2e suite"): every `securitypolicyviolation`
// event in any document the page loads (a binding, so full reloads such as
// /set-lang keep reporting), and every console error that names the policy
// (Chromium/WebKit "Refused to … Content Security Policy", Firefox
// "Content-Security-Policy: …"). Warnings are ignored: Firefox warns about
// sources it ignores (e.g. 'unsafe-inline' beside a nonce), which block nothing.

export type CspViolation = { from: 'event' | 'console'; detail: string };

const REPORT_BINDING = '__reportCspViolation';
const CSP_CONSOLE_PATTERN = /content[ -]security[ -]policy/i;

function listenForViolations(binding: string) {
	document.addEventListener(
		'securitypolicyviolation',
		(e) => {
			const report = (window as unknown as Record<string, (detail: string) => void>)[binding];
			report(`${e.effectiveDirective} blocked ${e.blockedURI || '(inline)'} on ${e.documentURI}`);
		},
		true
	);
}

const isCspError = (msg: ConsoleMessage) =>
	msg.type() === 'error' && CSP_CONSOLE_PATTERN.test(msg.text());

export async function watchCspViolations(page: Page): Promise<CspViolation[]> {
	const found: CspViolation[] = [];
	await page.exposeBinding(REPORT_BINDING, (_source, detail: string) => {
		found.push({ from: 'event', detail });
	});
	await page.addInitScript(listenForViolations, REPORT_BINDING);
	page.on('console', (msg) => {
		if (isCspError(msg)) found.push({ from: 'console', detail: msg.text() });
	});
	return found;
}
