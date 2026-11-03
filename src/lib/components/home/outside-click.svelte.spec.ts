import { afterEach, describe, expect, it } from 'vitest';
import { isClearingClick } from './outside-click.ts';

// FE-9 FB-14 (D-FE9-9): which desktop clicks clear the selected region.

const plain = {
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	defaultPrevented: false
};

const PAGE = `
	<header data-id="top-bar"><span data-id="top-bar-spacer"></span></header>
	<main>
		<div data-id="map"><span data-id="sea"></span><a href="/en/regions/gal"><span data-id="cell"></span></a></div>
		<section data-id="about"><h1 data-id="title">Title</h1></section>
		<div data-id="panel"><p data-id="panel-text">Text</p></div>
		<button><span data-id="in-button"></span></button>
		<input data-id="input" />
		<select data-id="select"></select>
		<textarea data-id="textarea"></textarea>
		<label><span data-id="in-label"></span></label>
		<details><summary><span data-id="in-summary"></span></summary></details>
		<div role="tab"><span data-id="in-tab"></span></div>
	</main>
`;

function stagePage() {
	document.body.innerHTML = PAGE;
	const byId = (id: string) => document.querySelector(`[data-id="${id}"]`)!;
	return { byId, areas: { panel: byId('panel'), topBar: byId('top-bar') } };
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isClearingClick', () => {
	for (const id of ['sea', 'map', 'about', 'title']) {
		it(`a plain click on ${id} clears`, () => {
			const { byId, areas } = stagePage();
			expect(isClearingClick({ ...plain, target: byId(id) }, areas)).toBe(true);
		});
	}

	it('a plain click on the page background (body) clears', () => {
		const { areas } = stagePage();
		expect(isClearingClick({ ...plain, target: document.body }, areas)).toBe(true);
	});

	const kept = [
		'panel',
		'panel-text',
		'top-bar',
		'top-bar-spacer',
		'cell',
		'in-button',
		'input',
		'select',
		'textarea',
		'in-label',
		'in-summary',
		'in-tab'
	];
	for (const id of kept) {
		it(`a plain click on ${id} keeps the region`, () => {
			const { byId, areas } = stagePage();
			expect(isClearingClick({ ...plain, target: byId(id) }, areas)).toBe(false);
		});
	}

	const notPlain = [
		{ name: 'a middle-button click', event: { button: 1 } },
		{ name: 'a Meta-click', event: { metaKey: true } },
		{ name: 'a Ctrl-click', event: { ctrlKey: true } },
		{ name: 'a Shift-click', event: { shiftKey: true } },
		{ name: 'an Alt-click', event: { altKey: true } },
		{ name: 'a click already handled', event: { defaultPrevented: true } }
	];
	for (const tc of notPlain) {
		it(`${tc.name} on the sea keeps the region`, () => {
			const { byId, areas } = stagePage();
			expect(isClearingClick({ ...plain, ...tc.event, target: byId('sea') }, areas)).toBe(false);
		});
	}

	it('a click whose target left the page keeps the region', () => {
		const { byId, areas } = stagePage();
		const sea = byId('sea');
		sea.remove();
		expect(isClearingClick({ ...plain, target: sea }, areas)).toBe(false);
	});

	it('a click on no element keeps the region', () => {
		const { areas } = stagePage();
		expect(isClearingClick({ ...plain, target: document }, areas)).toBe(false);
		expect(isClearingClick({ ...plain, target: null }, areas)).toBe(false);
	});

	it('without the panel or top bar mounted, only interactive targets keep it', () => {
		const { byId } = stagePage();
		const none = { panel: undefined, topBar: undefined };
		expect(isClearingClick({ ...plain, target: byId('panel-text') }, none)).toBe(true);
		expect(isClearingClick({ ...plain, target: byId('cell') }, none)).toBe(false);
	});
});
