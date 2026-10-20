import { describe, expect, expectTypeOf, it } from 'vitest';
import bundle from './content.bundle.json';
import apiSample from '../../../testutil/api-sample.dishes.ru.json';
import {
	NO_PHOTOS,
	type CatalogSource,
	type Dish,
	type ErrorClass,
	type Lang,
	type Recipe,
	type Region,
	type RegionDetail
} from '../../../testutil/catalog';
import { loadExport } from '../../../testutil/load-export';
// Type-only: erased at run time, checked by `pnpm check`.
import type { components } from '#lib/api/schema.d.ts';
import type { createMockSource as CreateMockSourceImpl } from './mock-source.ts';

// FE-2 mock adapter (DATA_SOURCE=mock): serves the vendored backend import
// bundle (recetas-backend/testdata/content.design.json) exactly as the API
// would, mapped into the OpenAPI response types.

type Schemas = components['schemas'];
type CreateMockSource = (input: typeof bundle) => CatalogSource;
type Validated<T> = Omit<T, 'tileColor'> & { tileColor: string | null };

const REGION_KEYS = [
	'gal',
	'ast',
	'bas',
	'cat',
	'cyl',
	'mad',
	'ara',
	'val',
	'ext',
	'clm',
	'mur',
	'and',
	'bal',
	'can'
];
const DISH_KEYS = [
	'tortilla',
	'paella',
	'cocido',
	'gazpacho',
	'croquetas',
	'torrijas',
	'arrozleche'
];
const LANGS: Lang[] = ['en', 'es', 'ru'];

async function mockSource() {
	const create = await loadExport<CreateMockSource>(
		'src/lib/server/mock/mock-source.ts',
		'createMockSource'
	);
	return create(bundle);
}

const notFoundError = () => loadExport<ErrorClass>('src/lib/server/api-errors.ts', 'NotFoundError');

async function regionOrder(source: CatalogSource): Promise<string[]> {
	return (await source.listRegions('en')).map((r) => r.key);
}

// The keys of an API body, recursively; values and array lengths are ignored.
function shapeOf(value: unknown): unknown {
	if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : [];
	if (value === null || typeof value !== 'object') return 'value';
	const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
	return Object.fromEntries(entries.map(([k, v]) => [k, shapeOf(v)]));
}

describe('mock listRegions', () => {
	const names: { lang: Lang; key: string; name: string; mapLabel: string }[] = [
		{ lang: 'en', key: 'gal', name: 'Galicia', mapLabel: 'Galicia' },
		{ lang: 'es', key: 'gal', name: 'Galicia', mapLabel: 'Galicia' },
		{ lang: 'ru', key: 'gal', name: 'Галисия', mapLabel: 'Галисия' },
		{ lang: 'en', key: 'bas', name: 'Basque Country', mapLabel: 'Euskadi' },
		{ lang: 'es', key: 'bas', name: 'País Vasco', mapLabel: 'Euskadi' },
		{ lang: 'ru', key: 'bas', name: 'Страна Басков', mapLabel: 'Баскония' },
		{ lang: 'ru', key: 'and', name: 'Андалусия', mapLabel: 'Андалусия' }
	];
	for (const want of names) {
		it(`names ${want.key} "${want.name}" in ${want.lang}`, async () => {
			const regions = await (await mockSource()).listRegions(want.lang);
			const region = regions.find((r) => r.key === want.key);
			expect(region?.name, `got ${region?.name}, want ${want.name}`).toBe(want.name);
			expect(region?.mapLabel).toBe(want.mapLabel);
		});
	}

	for (const lang of LANGS) {
		it(`lists all 14 regions in region order with order 1..14 in ${lang}`, async () => {
			const regions = await (await mockSource()).listRegions(lang);
			expect(regions.map((r) => r.key)).toEqual(REGION_KEYS);
			expect(regions.map((r) => r.order)).toEqual(REGION_KEYS.map((_, i) => i + 1));
		});

		it(`carries the Spanish name as nameEs in ${lang}`, async () => {
			const source = await mockSource();
			const spanish = (await source.listRegions('es')).map((r) => r.name);
			const got = (await source.listRegions(lang)).map((r) => r.nameEs);
			expect(got).toEqual(spanish);
		});
	}

	it('serves the full localized Galicia region', async () => {
		const regions = await (await mockSource()).listRegions('ru');
		expect(regions[0]).toEqual<Region>({
			key: 'gal',
			order: 1,
			name: 'Галисия',
			nameEs: 'Galicia',
			mapLabel: 'Галисия',
			tileColor: '#9A9A5E',
			description: 'Атлантические морепродукты, еда паломников и самый любимый осьминог Испании.',
			regionalDishes: ['Pulpo á feira', 'Empanada gallega', 'Lacón con grelos']
		});
	});
});

describe('mock listDishes and getDish', () => {
	const names: { lang: Lang; key: string; name: string; nameEs: string }[] = [
		{ lang: 'en', key: 'tortilla', name: 'Tortilla de patatas', nameEs: 'Tortilla de patatas' },
		{ lang: 'es', key: 'tortilla', name: 'Tortilla de patatas', nameEs: 'Tortilla de patatas' },
		{ lang: 'ru', key: 'tortilla', name: 'Тортилья', nameEs: 'Tortilla de patatas' },
		{ lang: 'en', key: 'paella', name: 'Rice dishes', nameEs: 'Arroces' },
		{ lang: 'es', key: 'paella', name: 'Arroces', nameEs: 'Arroces' },
		{ lang: 'ru', key: 'paella', name: 'Блюда из риса', nameEs: 'Arroces' }
	];
	for (const want of names) {
		it(`names ${want.key} "${want.name}" in ${want.lang}, in the list and in getDish`, async () => {
			const source = await mockSource();
			const listed = (await source.listDishes(want.lang)).find((d) => d.key === want.key);
			const single = await source.getDish(want.lang, want.key);
			for (const dish of [listed, single]) {
				expect(dish?.name, `got ${dish?.name}, want ${want.name}`).toBe(want.name);
				expect(dish?.nameEs).toBe(want.nameEs);
			}
		});
	}

	it('lists the dishes in dish order with order 1..7', async () => {
		const dishes = await (await mockSource()).listDishes('en');
		expect(dishes.map((d) => d.key)).toEqual(DISH_KEYS);
		expect(dishes.map((d) => d.order)).toEqual(DISH_KEYS.map((_, i) => i + 1));
	});

	it('keeps flags, course and season', async () => {
		const dish = await (await mockSource()).getDish('es', 'tortilla');
		expect(dish.flags).toEqual({
			vegetarian: true,
			seafood: false,
			pork: false,
			quick: true,
			slowCooked: false
		});
		expect(dish.course).toBe('tapas');
		expect(dish.season).toBe('all');
	});

	it('orders paella variations by region order, not bundle order', async () => {
		const dish = await (await mockSource()).getDish('en', 'paella');
		const got = dish.variations.map((v) => v.regionKey);
		expect(got).toEqual(['cat', 'ara', 'val', 'mur', 'and', 'bal', 'can']);
	});

	for (const key of DISH_KEYS) {
		it(`orders ${key} variations by region order in the list and in getDish`, async () => {
			const source = await mockSource();
			const order = await regionOrder(source);
			const listed = (await source.listDishes('ru')).find((d) => d.key === key);
			const single = await source.getDish('ru', key);
			for (const dish of [listed, single]) {
				const got = dish?.variations.map((v) => v.regionKey) ?? [];
				const want = [...got].sort((a, b) => order.indexOf(a) - order.indexOf(b));
				expect(got, `got ${got.join(',')}, want ${want.join(',')}`).toEqual(want);
			}
		});
	}

	it('serves a localized variation summary with exactly the schema fields (no "primary")', async () => {
		const dish = await (await mockSource()).getDish('ru', 'paella');
		const valencia = dish.variations.find((v) => v.regionKey === 'val');
		expect(valencia).toStrictEqual<Dish['variations'][number]>({
			regionKey: 'val',
			regionName: 'Валенсия',
			recipeKey: 'paella-val',
			name: 'Paella valenciana',
			nameEs: 'Paella valenciana',
			description: 'Кролик, курица и фасоль гаррофо — никогда не чорисо',
			photos: NO_PHOTOS
		});
	});

	it('maps a missing dish photo to null roles, as the API does', async () => {
		const dish = await (await mockSource()).getDish('en', 'tortilla');
		expect(dish.photos).toStrictEqual(NO_PHOTOS);
		expect(dish.variations[0].photos).toStrictEqual(NO_PHOTOS);
	});
});

describe('mock getRegion', () => {
	it('lists the variations cooked in a region in dish order', async () => {
		const region = await (await mockSource()).getRegion('en', 'gal');
		const got = region.variations.map((v) => v.dishKey);
		expect(got).toEqual(['tortilla', 'cocido', 'croquetas', 'torrijas']);
	});

	it('serves the region fields plus localized region variations', async () => {
		const source = await mockSource();
		const region = await source.getRegion('ru', 'gal');
		const listed = (await source.listRegions('ru'))[0];
		expect(region).toMatchObject(listed);
		expect(region.variations[0]).toStrictEqual<RegionDetail['variations'][number]>({
			dishKey: 'tortilla',
			dishName: 'Тортилья',
			dishNameEs: 'Tortilla de patatas',
			regionKey: 'gal',
			recipeKey: 'tortilla-gal',
			name: 'По-бетансосски, жидкая внутри',
			nameEs: 'Estilo Betanzos, jugosa',
			description: 'Едва схваченная серединка, без лука, едят с хлебом',
			photos: NO_PHOTOS
		});
	});
});

describe('mock getRecipe', () => {
	it('finds the recipe by dish and region (en)', async () => {
		const recipe = await (
			await mockSource()
		).getRecipe('en', {
			dishKey: 'tortilla',
			regionKey: 'gal'
		});
		expect(recipe).toMatchObject<Partial<Recipe>>({
			dishKey: 'tortilla',
			dishName: 'Tortilla de patatas',
			regionKey: 'gal',
			regionName: 'Galicia',
			recipeKey: 'tortilla-gal',
			name: 'Betanzos-style runny',
			nameEs: 'Estilo Betanzos, jugosa',
			description: 'Barely-set centre, no onion, eaten with bread',
			timeMinutes: 25,
			timeNote: null,
			baseServings: 2,
			photos: NO_PHOTOS
		});
		expect(recipe.ingredients[0]).toEqual({ quantity: 4, unit: null, name: 'Eggs' });
		expect(recipe.ingredients[1]).toEqual({ quantity: 400, unit: 'g', name: 'Waxy potatoes' });
		expect(recipe.steps[0]).toBe('Peel the potatoes and slice them very thin.');
	});

	it('localizes the recipe text, including the time note (ru)', async () => {
		const recipe = await (
			await mockSource()
		).getRecipe('ru', {
			dishKey: 'cocido',
			regionKey: 'ast'
		});
		expect(recipe.dishName).toBe('Косидо и рагу');
		expect(recipe.regionName).toBe('Астурия');
		expect(recipe.timeMinutes).toBe(180);
		expect(recipe.timeNote).toBe('+ замачивание');
		expect(recipe.baseServings).toBe(4);
		expect(recipe.ingredients[0]).toEqual({
			quantity: 500,
			unit: 'g',
			name: 'Фасоль фабес-де-ла-гранха'
		});
		expect(recipe.steps[0]).toBe('Замочите фасоль на ночь в холодной воде.');
	});

	it('has a recipe for every variation of every dish', async () => {
		const source = await mockSource();
		const refs = (await source.listDishes('es')).flatMap((d) =>
			d.variations.map((v) => ({ dishKey: d.key, regionKey: v.regionKey, recipeKey: v.recipeKey }))
		);
		expect(refs).toHaveLength(54);
		for (const ref of refs) {
			const recipe = await source.getRecipe('es', ref);
			expect(recipe.recipeKey, `got ${recipe.recipeKey} for ${ref.dishKey}/${ref.regionKey}`).toBe(
				ref.recipeKey
			);
		}
	});
});

describe('mock unknown keys', () => {
	const misses: { name: string; call: (s: CatalogSource) => Promise<unknown> }[] = [
		{ name: 'getRegion nope', call: (s) => s.getRegion('en', 'nope') },
		{ name: 'getDish nope', call: (s) => s.getDish('ru', 'nope') },
		{
			name: 'getRecipe of an unknown dish',
			call: (s) => s.getRecipe('en', { dishKey: 'nope', regionKey: 'gal' })
		},
		{
			name: 'getRecipe of an unknown region',
			call: (s) => s.getRecipe('en', { dishKey: 'tortilla', regionKey: 'nope' })
		},
		{
			name: 'getRecipe of a region the dish is not cooked in',
			call: (s) => s.getRecipe('es', { dishKey: 'paella', regionKey: 'gal' })
		}
	];
	for (const miss of misses) {
		it(`${miss.name} rejects with NotFoundError`, async () => {
			const NotFoundError = await notFoundError();
			await expect(miss.call(await mockSource())).rejects.toBeInstanceOf(NotFoundError);
		});
	}
});

describe('mock contract', () => {
	it('has the same body shape as a live /v1/dishes response', async () => {
		const dishes = await (await mockSource()).listDishes('ru');
		expect(shapeOf(dishes)).toEqual(shapeOf(apiSample));
	});

	it('type-checks against the OpenAPI schema types (enforced by pnpm check)', async () => {
		type Impl = ReturnType<typeof CreateMockSourceImpl>;
		expectTypeOf<typeof CreateMockSourceImpl>().toBeCallableWith(bundle);
		expectTypeOf<Impl>().toExtend<CatalogSource>();
		// Regions are the schema types with tileColor nullable (region-colour.ts).
		expectTypeOf<CatalogSource['listRegions']>().returns.resolves.toEqualTypeOf<
			Validated<Schemas['Region']>[]
		>();
		expectTypeOf<Region['tileColor']>().toEqualTypeOf<string | null>();
		expectTypeOf<Omit<Region, 'tileColor'>>().toEqualTypeOf<Omit<Schemas['Region'], 'tileColor'>>();
		expectTypeOf<CatalogSource['listDishes']>().returns.resolves.toEqualTypeOf<Schemas['Dish'][]>();
		expectTypeOf<CatalogSource['getRegion']>().returns.resolves.toEqualTypeOf<
			Validated<Schemas['RegionDetail']>
		>();
		expectTypeOf<RegionDetail['tileColor']>().toEqualTypeOf<string | null>();
		expectTypeOf<Omit<RegionDetail, 'tileColor'>>().toEqualTypeOf<
			Omit<Schemas['RegionDetail'], 'tileColor'>
		>();
		expectTypeOf<CatalogSource['getDish']>().returns.resolves.toEqualTypeOf<Schemas['Dish']>();
		expectTypeOf<CatalogSource['getRecipe']>().returns.resolves.toEqualTypeOf<Schemas['Recipe']>();
		expect(await mockSource()).toBeDefined();
	});
});
