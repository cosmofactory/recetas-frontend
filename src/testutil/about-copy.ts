// FE-9 FB-8 (D-FE9-4): the home "about" copy, strings.json home.aboutTitle /
// home.aboutBody (moved from desktop.*; the same text on both layouts).
// Plain constants only (no #lib, node: or Playwright imports), so component,
// SSR and Playwright specs can all load them.

export const ABOUT_LOCALES = ['en', 'es', 'ru'] as const;
export type AboutLocale = (typeof ABOUT_LOCALES)[number];

export const ABOUT_COPY: Record<AboutLocale, { title: string; body: string }> = {
	en: {
		title: 'How Spain really cooks',
		body: 'Asadorov is an atlas of Spanish home cooking. Pick a region to see its dishes, or follow one dish across the country — every region cooks it a little differently, and each variation comes with its own recipe.'
	},
	es: {
		title: 'Así cocina España de verdad',
		body: 'Asadorov es un atlas de la cocina casera española. Elige una región para ver sus platos o sigue un plato por todo el país: cada región lo cocina a su manera, y cada variante tiene su propia receta.'
	},
	ru: {
		title: 'Как на самом деле готовит Испания',
		body: 'Asadorov — атлас испанской домашней кухни. Выберите регион, чтобы увидеть его блюда, или проследите одно блюдо по всей стране: в каждом регионе его готовят по-своему, и у каждого варианта есть свой рецепт.'
	}
};

// The logo: never translated, the one literal check:strings allows.
export const LOGO = 'Asadorov';
