// FE-6 PR 3 fixtures shared by the Recipe page's SSR spec, the time
// formatter's unit spec and the Playwright specs: plain constants only (no
// #lib, node: or Playwright imports), so every runner can load them. Copy is
// strings.json recipe.* and, for what the design lacks (stage FE-6 -> Small
// decisions), the extra-strings.json keys the writer adds: the stepper's
// − / + names, the servings announcement and the time unit labels.

export const RECIPE_LOCALES = ['en', 'es', 'ru'] as const;
export type RecipeLocale = (typeof RECIPE_LOCALES)[number];

// Test ids the Recipe page exposes (FE-6 PR 3 contract).
export const RECIPE_TEST_IDS = {
	// "REGION · DISH" above the <h1>.
	eyebrow: 'recipe-eyebrow',
	// The info strip's formatted time value ("25 min", "3 h + soaking").
	time: 'recipe-time',
	// The stepper's visible value ("2").
	servingsValue: 'servings-value',
	// The aria-live="polite" element that announces the new servings.
	servingsLive: 'servings-live',
	// One per ingredient: the toggle <button aria-pressed>, the whole row.
	ingredient: 'recipe-ingredient',
	// Inside an ingredient row: the right-aligned quantity.
	quantity: 'recipe-quantity',
	// One per method step: the toggle <button aria-pressed>, the whole row.
	step: 'recipe-step',
	// Inside an ingredient or step row: the check / number circle.
	check: 'recipe-check'
} as const;

// Mobile README -> Screen 3: the bar's title and hairline appear past 280px.
export const RECIPE_THRESHOLD_PX = 280;
// Mobile README -> Screen 3 -> Info strip: "Range 1–20".
export const SERVINGS_MIN = 1;
export const SERVINGS_MAX = 20;
// Done rows keep full opacity: the README's "row opacity 0.45" fails AA
// (about 2.4:1) on a row that stays operable, so their text takes --ink-3
// instead (stack.md X10, stage FE-6 -> Small decisions).
export const DONE_ROW_OPACITY = '1';
export const DONE_TEXT_COLOUR_TOKEN = 'var(--ink-3)';

export type RecipeCopy = {
	time: string;
	serves: string;
	ingredients: string;
	method: string;
	// extra-strings.json (stage FE-6 -> Small decisions): the stepper buttons.
	fewer: string;
	more: string;
	// extra-strings.json: the live announcement, an ICU plural with the number.
	servings: Partial<Record<Intl.LDMLPluralRule, string>>;
	// extra-strings.json: time unit labels ("1 h 15 min", "1 ч 15 мин").
	hours: string;
	minutes: string;
};

export const RECIPE_COPY: Record<RecipeLocale, RecipeCopy> = {
	en: {
		time: 'Time',
		serves: 'Serves',
		ingredients: 'Ingredients',
		method: 'Method',
		fewer: 'Fewer servings',
		more: 'More servings',
		servings: { one: '# serving', other: '# servings' },
		hours: 'h',
		minutes: 'min'
	},
	es: {
		time: 'Tiempo',
		serves: 'Raciones',
		ingredients: 'Ingredientes',
		method: 'Elaboración',
		fewer: 'Menos raciones',
		more: 'Más raciones',
		servings: { one: '# ración', other: '# raciones' },
		hours: 'h',
		minutes: 'min'
	},
	ru: {
		time: 'Время',
		serves: 'Порции',
		ingredients: 'Ингредиенты',
		method: 'Приготовление',
		fewer: 'Меньше порций',
		more: 'Больше порций',
		servings: { one: '# порция', few: '# порции', many: '# порций' },
		hours: 'ч',
		minutes: 'мин'
	}
};

// The servings announcement for a count ("5 servings", "2 порции", "5 порций").
export function servingsAnnouncement(lang: RecipeLocale, count: number): string {
	const rule = new Intl.PluralRules(lang).select(count);
	const form = RECIPE_COPY[lang].servings[rule] ?? RECIPE_COPY[lang].servings.other;
	if (!form) throw new Error(`no ${rule} servings form for ${lang}`);
	return form.replace('#', String(count));
}

export type RecipePageCopy = {
	dishKey: string;
	regionKey: string;
	region: string;
	dish: string;
	name: string;
	description: string;
	time: string;
	baseServings: number;
};

// The Betanzos recipe (tortilla/gal, base 2 servings, 25 min). The eyebrow's
// dish is the API's dishName in that locale (content decides which names stay
// Spanish; the ru content calls it "Тортилья").
export const BETANZOS: Record<RecipeLocale, RecipePageCopy> = {
	en: {
		dishKey: 'tortilla',
		regionKey: 'gal',
		region: 'Galicia',
		dish: 'Tortilla de patatas',
		name: 'Betanzos-style runny',
		description: 'Barely-set centre, no onion, eaten with bread',
		time: '25 min',
		baseServings: 2
	},
	es: {
		dishKey: 'tortilla',
		regionKey: 'gal',
		region: 'Galicia',
		dish: 'Tortilla de patatas',
		name: 'Estilo Betanzos, jugosa',
		description: 'Centro apenas cuajado, sin cebolla, con pan',
		time: '25 min',
		baseServings: 2
	},
	ru: {
		dishKey: 'tortilla',
		regionKey: 'gal',
		region: 'Галисия',
		dish: 'Тортилья',
		name: 'По-бетансосски, жидкая внутри',
		description: 'Едва схваченная серединка, без лука, едят с хлебом',
		time: '25 мин',
		baseServings: 2
	}
};

// The fabada (cocido/ast): 180 minutes plus a note.
export const FABADA_TIME: Record<RecipeLocale, string> = {
	en: '3 h + soaking',
	es: '3 h + remojo',
	ru: '3 ч + замачивание'
};

// Another tortilla recipe, to check the reset: tortilla/ast serves 4.
export const TORTILLA_AST = { regionKey: 'ast', name: 'With chorizo', baseServings: 4 } as const;

// Tortilla has no Canarias variation: a known dish and region, no recipe.
export const MISSING_PAIR = { dishKey: 'tortilla', regionKey: 'can' } as const;

export const variationsPath = (lang: string, dishKey: string) => `/${lang}/dishes/${dishKey}`;

// The servings the specs step through: the bounds, the base and the
// acceptance case (2 → 5).
export const CHECKED_SERVINGS = [1, 2, 5, 20] as const;
export type CheckedServings = (typeof CHECKED_SERVINGS)[number];

export type IngredientRow = { name: string; quantity: string };

const BETANZOS_NAMES: Record<RecipeLocale, string[]> = {
	en: ['Eggs', 'Waxy potatoes', 'Olive oil, for confit', 'Salt'],
	es: ['Huevos', 'Patatas de carne firme', 'Aceite de oliva, para confitar', 'Sal'],
	ru: ['Яйца', 'Плотный картофель', 'Оливковое масло для конфи', 'Соль']
};

// Quantities per servings count, in ingredient order.
const BETANZOS_QUANTITIES: Record<RecipeLocale, Record<CheckedServings, string[]>> = {
	en: {
		1: ['2', '200 g', '130 ml', '½ tsp'],
		2: ['4', '400 g', '250 ml', '1 tsp'],
		5: ['10', '1 kg', '630 ml', '2½ tsp'],
		20: ['40', '4 kg', '2.5 L', '10 tsp']
	},
	es: {
		1: ['2', '200 g', '130 ml', '½ cdta'],
		2: ['4', '400 g', '250 ml', '1 cdta'],
		5: ['10', '1 kg', '630 ml', '2½ cdta'],
		20: ['40', '4 kg', '2,5 L', '10 cdta']
	},
	ru: {
		1: ['2', '200 г', '130 мл', '½ ч. л.'],
		2: ['4', '400 г', '250 мл', '1 ч. л.'],
		5: ['10', '1 кг', '630 мл', '2½ ч. л.'],
		20: ['40', '4 кг', '2,5 л', '10 ч. л.']
	}
};

// The Betanzos ingredients at a checked servings count. Playwright can't
// load the formatter (Paraglide needs Vite), so the expected text is written
// out here; recipe-copy.spec.ts derives every row with scaleQuantity /
// formatQuantity from the bundle and fails when this table drifts.
export function betanzosIngredients(
	lang: RecipeLocale,
	servings: CheckedServings
): IngredientRow[] {
	const quantities = BETANZOS_QUANTITIES[lang][servings];
	return BETANZOS_NAMES[lang].map((name, i) => ({ name, quantity: quantities[i] }));
}

// The Betanzos method: five steps; the first and last, per locale.
export const BETANZOS_STEPS: Record<RecipeLocale, { count: number; first: string; last: string }> =
	{
		en: {
			count: 5,
			first: 'Peel the potatoes and slice them very thin.',
			last: 'Flip with a plate, cook 20 seconds more and serve at once — the centre should run.'
		},
		es: {
			count: 5,
			first: 'Pela las patatas y córtalas muy finas.',
			last: 'Dale la vuelta con un plato, 20 segundos más y sirve enseguida: el centro debe quedar jugoso.'
		},
		ru: {
			count: 5,
			first: 'Очистите картофель и нарежьте очень тонко.',
			last: 'Переверните с помощью тарелки, жарьте ещё 20 секунд и сразу подавайте — серединка должна остаться жидкой.'
		}
	};

// The longest page in the bundle (9 ingredients): long enough to scroll past
// the bar threshold at every mobile viewport, 932px tall included. Its name
// stays Spanish in every locale.
export const PAELLA_VAL = {
	dishKey: 'paella',
	regionKey: 'val',
	name: 'Paella valenciana'
} as const;
