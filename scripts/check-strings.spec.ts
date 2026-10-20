import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExport, repoFile } from '../src/testutil/load-export';

// FE-1: `pnpm check:strings` (part of `pnpm lint`) fails on user-visible text
// written straight into .svelte markup and on raw internal hrefs. The logo
// "Asadorov" is the only allowed literal (README -> Localization rules).

type Violation = { line: number; message: string };
type FindViolations = (source: string, filename: string) => Violation[];

const load = () => loadExport<FindViolations>('scripts/check-strings.ts', 'findViolations');

describe('findViolations: clean markup', () => {
	const clean: { name: string; source: string }[] = [
		{ name: 'an empty component', source: '' },
		{ name: 'a message call', source: '<h1>{m.home_regional()}</h1>' },
		{ name: 'whitespace between elements', source: '<div>\n\t<span>{a}</span>\n\t\n</div>' },
		{ name: 'the logo literal', source: '<span class="logo">Asadorov</span>' },
		{
			name: 'the logo literal with surrounding whitespace',
			source: '<a href={home}>\n\tAsadorov\n</a>'
		},
		{
			name: 'the logo literal in <title>',
			source: '<svelte:head><title>Asadorov</title></svelte:head>'
		},
		{
			name: 'strings in the script block',
			source: "<script>const s = 'Hello';</script><p>{s}</p>"
		},
		{
			name: 'strings in a module script',
			source: '<script module>export const x = "Hi";</script><p>{x}</p>'
		},
		{
			name: 'CSS in the style block',
			source: "<p>{a}</p><style>p::after { content: 'x'; }</style>"
		},
		{ name: 'an HTML comment', source: '<!-- TODO: copy here --><p>{a}</p>' },
		{ name: 'href from localizedHref', source: "<a href={localizedHref('/', lang)}>{label}</a>" },
		{ name: 'an external href', source: '<a href="https://svelte.dev">{label}</a>' },
		{ name: 'a fragment href', source: '<a href="#main">{label}</a>' },
		{ name: 'a non-href attribute starting with /', source: '<img src="/logo.svg" alt={alt} />' },
		{ name: 'a mustache inside a block', source: '{#if open}{m.home_filters()}{/if}' }
	];
	for (const tc of clean) {
		it(`reports nothing for ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Clean.svelte');
			expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
		});
	}
});

describe('findViolations: hard-coded text', () => {
	const bad: { name: string; source: string; text: string; line: number }[] = [
		{ name: 'text in a heading', source: '<h1>Welcome</h1>', text: 'Welcome', line: 1 },
		{
			name: 'text next to a mustache',
			source: '<p>{n} variations</p>',
			text: 'variations',
			line: 1
		},
		{ name: 'text inside an #if block', source: '{#if x}Hello{/if}', text: 'Hello', line: 1 },
		{
			name: 'text inside an #each block',
			source: '{#each items as i}<li>Item</li>{/each}',
			text: 'Item',
			line: 1
		},
		{
			name: 'text in a component slot',
			source: '<Button>Clear all</Button>',
			text: 'Clear all',
			line: 1
		},
		{
			name: 'text on a later line',
			source: '<script>\n\tlet a = 1;\n</script>\n\n<div>\n\t<p>Filters</p>\n</div>',
			text: 'Filters',
			line: 6
		},
		{
			name: 'the logo word plus more text',
			source: '<span>Asadorov rocks</span>',
			text: 'Asadorov rocks',
			line: 1
		},
		{ name: 'non-Latin text', source: '<p>Фильтры</p>', text: 'Фильтры', line: 1 }
	];
	for (const tc of bad) {
		it(`reports ${tc.name} on line ${tc.line}`, async () => {
			const got = (await load())(tc.source, 'Bad.svelte');
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			expect(got[0].line, `got line ${got[0].line}, want ${tc.line}`).toBe(tc.line);
			expect(got[0].message, `got message ${got[0].message}, want it to quote the text`).toContain(
				tc.text
			);
		});
	}

	it('reports each offending node separately', async () => {
		const got = (await load())('<h1>One</h1>\n<p>Two</p>', 'Bad.svelte');
		const lines = got.map((v) => v.line);
		expect(lines, `got ${JSON.stringify(got)}, want lines [1, 2]`).toEqual([1, 2]);
	});
});

describe('findViolations: raw internal hrefs', () => {
	const bad: { name: string; source: string; href: string }[] = [
		{ name: 'a root-relative href', source: '<a href="/en/">{l}</a>', href: '/en/' },
		{
			name: 'a deep href',
			source: '<a href="/es/dishes/tortilla">{l}</a>',
			href: '/es/dishes/tortilla'
		},
		{ name: 'a bare / href', source: '<a href="/">{l}</a>', href: '/' },
		{ name: 'a literal / followed by a mustache', source: '<a href="/{lang}/">{l}</a>', href: '/' },
		{ name: 'an unquoted href', source: '<a href=/ru/dishes >{l}</a>', href: '/ru/dishes' },
		{
			name: 'an href on a component',
			source: '<Link href="/ru/regions/gal">{l}</Link>',
			href: '/ru/regions/gal'
		}
	];
	for (const tc of bad) {
		it(`reports ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Bad.svelte');
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			expect(got[0].line).toBe(1);
			expect(got[0].message, `got message ${got[0].message}, want it to mention href`).toMatch(
				/href/i
			);
			expect(got[0].message, `got message ${got[0].message}, want it to quote the value`).toContain(
				tc.href
			);
		});
	}
});

describe('findViolations: user-visible attributes', () => {
	const clean: { name: string; source: string }[] = [
		{ name: 'an empty alt on a decorative image', source: '<img src={src} alt="" />' },
		{ name: 'alt from a message', source: '<img src={src} alt={m.home_regional()} />' },
		{
			name: 'aria-label from a message',
			source: '<button aria-label={m.search_cancel()}></button>'
		},
		{
			name: 'placeholder from a message',
			source: '<input placeholder={m.search_placeholder()} />'
		},
		{ name: 'title from a variable', source: '<abbr title={full}>{short}</abbr>' },
		{ name: 'aria-description from a message', source: '<div aria-description={m.x()}></div>' },
		{ name: 'the logo literal in aria-label', source: '<a href={home} aria-label="Asadorov"></a>' },
		{
			name: 'a non-visible attribute literal',
			source: '<div class="card" data-testid="app-shell"></div>'
		},
		{ name: 'an id and a role', source: '<nav id="main" role="navigation"></nav>' }
	];
	for (const tc of clean) {
		it(`reports nothing for ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Clean.svelte');
			expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
		});
	}

	const bad: { name: string; source: string; attr: string; text: string; line: number }[] = [
		{
			name: 'a literal alt',
			source: '<img src={src} alt="A paella" />',
			attr: 'alt',
			text: 'A paella',
			line: 1
		},
		{
			name: 'a literal aria-label',
			source: '<button aria-label="Close"></button>',
			attr: 'aria-label',
			text: 'Close',
			line: 1
		},
		{
			name: 'a literal placeholder',
			source: '<input placeholder="Search dishes" />',
			attr: 'placeholder',
			text: 'Search dishes',
			line: 1
		},
		{
			name: 'a literal title',
			source: '<abbr title="Kilogram">{u}</abbr>',
			attr: 'title',
			text: 'Kilogram',
			line: 1
		},
		{
			name: 'a literal aria-description',
			source: '<div aria-description="Opens the map"></div>',
			attr: 'aria-description',
			text: 'Opens the map',
			line: 1
		},
		{
			name: 'literal text mixed with a mustache',
			source: '<img src={src} alt="Photo of {name}" />',
			attr: 'alt',
			text: 'Photo of',
			line: 1
		},
		{
			name: 'an unquoted literal',
			source: '<button aria-label=Close></button>',
			attr: 'aria-label',
			text: 'Close',
			line: 1
		},
		{
			name: 'a literal on a component prop of the same name',
			source: '<Icon title="Menu" />',
			attr: 'title',
			text: 'Menu',
			line: 1
		},
		{
			name: 'a literal on a later line',
			source: '<div>\n\t<input\n\t\tplaceholder="Type here"\n\t/>\n</div>',
			attr: 'placeholder',
			text: 'Type here',
			line: 3
		}
	];
	for (const tc of bad) {
		it(`reports ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Bad.svelte');
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			expect(got[0].line, `got line ${got[0].line}, want ${tc.line}`).toBe(tc.line);
			const message = got[0].message;
			expect(message, `got message ${message}, want it to name ${tc.attr}`).toContain(tc.attr);
			expect(message, `got message ${message}, want it to quote the text`).toContain(tc.text);
		});
	}
});

// Literals hidden in expressions count as hard-coded copy: the expression
// itself, a template literal's text, and the branches of `? :`, `||` and `??`.
// Literals passed as call arguments (message inputs, unit keys) do not.
describe('findViolations: literal expressions', () => {
	const clean: { name: string; source: string }[] = [
		{ name: 'a whitespace literal for spacing', source: "<p>{a}{' '}{b}</p>" },
		{ name: 'an empty string literal', source: "<p>{''}</p>" },
		{ name: 'the logo as a literal', source: "<span>{'Asadorov'}</span>" },
		{ name: 'a template literal of expressions only', source: '<p>{`${a}${b}`}</p>' },
		{ name: 'literal call arguments', source: "<p>{unitLabel(locale, 'kg')}</p>" },
		{ name: 'literal message inputs', source: "<p>{m.home_variation({ count: 2, x: 'y' })}</p>" },
		{ name: 'an empty alt as an expression', source: "<img src={src} alt={''} />" },
		{
			name: 'a template href to another origin',
			source: '<a href={`https://svelte.dev/${k}`}>{l}</a>'
		},
		{
			name: 'the set-lang link from setLangHref',
			source: '<a href={setLangHref(l, page.url.pathname)}>{name}</a>'
		},
		{ name: 'a literal on an unwatched attribute', source: "<div class={open ? 'a' : 'b'}></div>" }
	];
	for (const tc of clean) {
		it(`reports nothing for ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Clean.svelte');
			expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
		});
	}

	const bad: { name: string; source: string; mentions: string }[] = [
		{ name: 'a string literal in text', source: "<p>{'Hello'}</p>", mentions: 'Hello' },
		{ name: 'a double-quoted literal in text', source: '<p>{"Hello"}</p>', mentions: 'Hello' },
		{ name: 'a template literal in text', source: '<p>{`Hello`}</p>', mentions: 'Hello' },
		{
			name: 'template text around an expression',
			source: '<p>{`${n} dishes`}</p>',
			mentions: 'dishes'
		},
		{
			name: 'ternary branches in text',
			source: "<p>{open ? 'Hide' : m.x()}</p>",
			mentions: 'Hide'
		},
		{ name: 'a ?? fallback in text', source: "<p>{name ?? 'Unknown'}</p>", mentions: 'Unknown' },
		{ name: 'a || fallback in text', source: "<p>{name || 'Unknown'}</p>", mentions: 'Unknown' },
		{
			name: 'a literal aria-label expression',
			source: "<button aria-label={'Close'}></button>",
			mentions: 'Close'
		},
		{
			name: 'a template aria-label',
			source: '<button aria-label={`Close`}></button>',
			mentions: 'Close'
		},
		{
			name: 'a literal placeholder expression',
			source: "<input placeholder={'Search'} />",
			mentions: 'Search'
		},
		{
			name: 'a ternary title',
			source: "<abbr title={k ? 'Kilogram' : m.x()}>{u}</abbr>",
			mentions: 'Kilogram'
		},
		{ name: 'a literal href expression', source: "<a href={'/en/'}>{l}</a>", mentions: 'href' },
		{ name: 'a template href', source: '<a href={`/en/${k}`}>{l}</a>', mentions: 'href' },
		{
			name: 'a literal set-lang href',
			source: '<a href="/set-lang?to=ru&next=/ru/">{l}</a>',
			mentions: 'href'
		},
		{
			name: 'a template set-lang href',
			source: '<a href={`/set-lang?to=${l}`}>{n}</a>',
			mentions: 'href'
		}
	];
	for (const tc of bad) {
		it(`reports ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Bad.svelte');
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			expect(got[0].message, `got ${got[0].message}, want it to mention ${tc.mentions}`).toContain(
				tc.mentions
			);
		});
	}

	it('leaves literal input values alone (only placeholder is watched)', async () => {
		const got = (await load())('<input type="hidden" name="to" value="ru" />', 'Clean.svelte');
		expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
	});
});

// Component props are copy unless their name is on the allow-list of
// non-copy props: class, id, variant, size, as, type, role and data-*, plus
// the FE-3 primitives' non-copy props icon (IconButton's icon name) and
// height, radius and sizes (Photo's CSS lengths and the image sizes list).
// (href is checked by the href rule; the watched attributes by theirs.)
describe('findViolations: component props', () => {
	const clean: { name: string; source: string }[] = [
		{ name: 'a prop from a message', source: '<Foo label={m.home_filters()} />' },
		{
			name: 'allow-listed literal props',
			source:
				'<Foo class="x" id="y" variant="primary" size="sm" as="h2" type="button" role="tab" />'
		},
		{ name: 'a data-* prop', source: '<Foo data-testid="region-sheet" />' },
		{ name: 'an empty literal prop', source: '<Foo label="" />' },
		{ name: 'the logo literal', source: '<Logo label="Asadorov" />' },
		{ name: 'a spread and a binding', source: '<Foo {...props} bind:open />' },
		{ name: 'a literal prop on a plain element', source: '<div label="x"></div>' },
		{
			name: 'an IconButton icon name',
			source: '<IconButton icon="search" label={m.a11y_search()} />'
		},
		{
			name: "Photo's height, radius and sizes",
			source:
				'<Photo photos={p} role="card" alt={alt} baseUrl={b} height="96px" radius="var(--radius-card)" sizes="(min-width: 860px) 33vw, 100vw" />'
		}
	];
	for (const tc of clean) {
		it(`reports nothing for ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Clean.svelte');
			expect(got, `got ${JSON.stringify(got)}, want []`).toEqual([]);
		});
	}

	const bad: { name: string; source: string; prop: string; text: string }[] = [
		{ name: 'a literal label', source: '<Foo label="Hello" />', prop: 'label', text: 'Hello' },
		{
			name: 'a literal expression prop',
			source: "<Foo label={'Hello'} />",
			prop: 'label',
			text: 'Hello'
		},
		{
			name: 'a non-allow-listed prop',
			source: '<Chip text="Seafood" />',
			prop: 'text',
			text: 'Seafood'
		},
		{
			name: 'a literal label next to an allowed icon',
			source: '<IconButton icon="search" label="Search" />',
			prop: 'label',
			text: 'Search'
		},
		{
			name: 'a namespaced component',
			source: '<Ui.Button label="Clear all" />',
			prop: 'label',
			text: 'Clear all'
		}
	];
	for (const tc of bad) {
		it(`reports ${tc.name}`, async () => {
			const got = (await load())(tc.source, 'Bad.svelte');
			expect(got.length, `got ${JSON.stringify(got)}, want 1 violation`).toBe(1);
			const message = got[0].message;
			expect(message, `got ${message}, want it to name ${tc.prop}`).toContain(tc.prop);
			expect(message, `got ${message}, want it to quote the text`).toContain(tc.text);
		});
	}
});

describe('pnpm check:strings', () => {
	const pkg = () =>
		JSON.parse(readFileSync(repoFile('package.json'), 'utf8')) as {
			scripts?: Record<string, string>;
		};

	it('is a package script that `pnpm lint` runs', () => {
		const scripts = pkg().scripts ?? {};
		expect(scripts['check:strings'], 'got no check:strings script, want one').toBeTypeOf('string');
		expect(scripts.lint, `got lint "${scripts.lint}", want it to run check:strings`).toContain(
			'check:strings'
		);
	});

	it('passes on the repository', () => {
		let status = 0;
		let output = '';
		try {
			execFileSync('pnpm', ['run', '--silent', 'check:strings'], {
				cwd: repoFile('.'),
				encoding: 'utf8',
				stdio: 'pipe'
			});
		} catch (err) {
			const e = err as { status?: number; stdout?: string; stderr?: string };
			status = e.status ?? 1;
			output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
		}
		expect(status, `got exit ${status}, want 0; output:\n${output}`).toBe(0);
	});
});
