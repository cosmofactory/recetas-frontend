<script lang="ts">
	import { localeNames, locales, type Locale } from '#lib/i18n/locales.ts';
	import { languageSwitchHref, type PageLocation } from '#lib/i18n/set-lang.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { menuKeyboard } from '#lib/ui/menu-keyboard.svelte.ts';
	import type { MenuFocus } from '#lib/ui/menu-keys.ts';
	import { motionFor, prefersReducedMotion } from '#lib/ui/motion.svelte.ts';
	import OutsideTapLayer from './OutsideTapLayer.svelte';

	// The header's language menu (both READMEs -> Overlay — Language menu),
	// an APG menu of links to /set-lang, controlled like OverlaySheet: `open`
	// shows it, onClose asks to close it (Escape, Tab, an outside tap), focus
	// returns to `opener` once it hides. lang: the page's locale (the ✓
	// row); url: the page URL, which every row keeps in its own locale.
	// initialFocus: the row focused on opening (ArrowUp on the button opens
	// on the last). hydrated: false in the server HTML, where a <details>
	// around it shows it and the rows are plain links in the Tab order (no
	// menu roles, no tabindex="-1", never inert).
	type Props = {
		id: string;
		open: boolean;
		lang: Locale;
		url: PageLocation;
		onClose: () => void;
		opener?: HTMLElement;
		size?: 'mobile' | 'desktop';
		initialFocus?: MenuFocus;
		hydrated?: boolean;
	};

	let {
		id,
		open,
		lang,
		url,
		onClose,
		opener,
		size = 'mobile',
		initialFocus = 'first',
		hydrated = true
	}: Props = $props();

	const labelId = $derived(`${id}-label`);
	const rows = $derived(
		locales.map((code) => ({
			code,
			name: localeNames[code],
			href: languageSwitchHref(url, code),
			current: code === lang
		}))
	);

	let menu: HTMLElement | undefined = $state();
	const fade = $derived(motionFor(prefersReducedMotion.current) === 'fade');
	// Spread: the roles exist only once hydrated (the server HTML is plain
	// links), which the compiler's static a11y checks can't follow.
	const menuRole = $derived(
		hydrated ? { role: 'menu', tabindex: -1, 'aria-labelledby': labelId } : {}
	);
	const itemRole = $derived(hydrated ? { role: 'menuitem', tabindex: -1 } : {});

	const onkeydown = menuKeyboard({
		menu: () => menu,
		open: () => open,
		initialFocus: () => initialFocus,
		onClose: () => onClose(),
		opener: () => opener
	});
</script>

<OutsideTapLayer {open} onclick={onClose} />
<div
	bind:this={menu}
	{id}
	class="menu"
	class:open
	class:desktop={size === 'desktop'}
	class:fade
	{...menuRole}
	inert={hydrated && !open}
	{onkeydown}
>
	<div id={labelId} class="eyebrow" aria-hidden="true">{m.home_language()}</div>
	{#each rows as row (row.code)}
		<a
			class="row"
			class:current={row.current}
			{...itemRole}
			lang={row.code}
			href={row.href}
			aria-current={row.current ? 'true' : undefined}
			data-sveltekit-reload
		>
			<span class="name">{row.name}</span>
			{#if row.current}
				<span class="mark" aria-hidden="true">✓</span>
			{:else}
				<span class="code" aria-hidden="true">{row.code.toUpperCase()}</span>
			{/if}
		</a>
	{/each}
</div>

<style>
	/*
	 * Mobile README: "top 70px in 2a …; right 16px), width 200px, bg surface,
	 * 1px --border-card, radius 14px, shadow …, padding 6px. Opens with
	 * opacity 0→1 (180ms) and translateY −6px→0 (220ms --ease)" (the
	 * prototype's opacity keeps the default ease). Closed, it paints nothing
	 * once the slide is over.
	 */
	.menu {
		position: fixed;
		top: 70px;
		right: 16px;
		z-index: var(--z-menu);
		width: 200px;
		padding: 6px;
		border: 1px solid var(--border-card);
		border-radius: 14px;
		background: var(--bg-surface);
		box-shadow: var(--shadow-menu);
		color: var(--ink);
		opacity: 0;
		visibility: hidden;
		transform: translateY(var(--menu-enter-offset));
		transition-property: opacity, transform, visibility;
		transition-duration: var(--dur-menu-fade), var(--dur-menu), 0s;
		transition-timing-function: ease, var(--ease), linear;
		transition-delay: 0s, 0s, var(--dur-menu);
	}

	/* Desktop README: "top 54px under the button, right-aligned), width 210px". */
	.menu.desktop {
		position: absolute;
		top: 54px;
		right: 0;
		width: 210px;
	}

	.menu.open,
	:global(details[open]) .menu {
		opacity: 1;
		visibility: visible;
		transform: none;
		transition-delay: 0s;
	}

	/* Accessibility: under reduced motion the slide becomes a fade. */
	.menu.fade {
		transform: none;
		transition-property: opacity, visibility;
		transition-duration: var(--dur-menu-fade), 0s;
		transition-delay: 0s, var(--dur-menu-fade);
	}

	.menu.fade.open {
		transition-delay: 0s;
	}

	/* "Eyebrow (10px/700, .11em, ink-4, padding 8px 12px 6px)"; ink-4 misses AA (X10). */
	.eyebrow {
		padding: 8px 12px 6px;
		color: var(--ink-eyebrow);
		font: 700 10px var(--font-text);
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	/* "Row: padding 12px, radius 9px, 14px/500, hover --bg-surface-muted"; prototype gap 10px. */
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px;
		border-radius: 9px;
		color: var(--ink);
		text-decoration: none;
		transition: background-color var(--dur-colour);
	}

	.row.current {
		background: var(--bg-surface-muted);
	}

	@media (hover: hover) {
		.row:hover {
			background: var(--bg-surface-muted);
		}
	}

	.name {
		font: 500 14px var(--font-text);
	}

	/*
	 * "the code (11px/700, ink-4), or ✓ in accent"; prototype letter-spacing
	 * .06em. ink-4 misses AA, so the code is --ink-3 (X10).
	 */
	.code,
	.mark {
		font: 700 11px var(--font-text);
		letter-spacing: 0.06em;
	}

	.code {
		color: var(--ink-3);
	}

	.mark {
		color: var(--accent-text);
	}
</style>
