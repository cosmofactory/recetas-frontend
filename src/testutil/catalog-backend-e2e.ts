import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import bundle from '../lib/server/mock/content.bundle.json' with { type: 'json' };
import { NotFoundError } from '../lib/server/api-errors.ts';
import type { CatalogSource, Dish, Lang, Photos } from '../lib/server/catalog-source.ts';
import type { ContentBundle } from '../lib/server/mock/bundle.ts';
import { createMockSource } from '../lib/server/mock/mock-source.ts';

// A fake Go API serving the vendored content bundle (through the mock source,
// which answers exactly as the API would), with photo prefixes added to some
// dishes: the bundle has none, so a MEDIA_BASE_URL run would otherwise only
// draw placeholders. Answers every catalog endpoint the app reads (the two
// lists, a region, a dish and a recipe); an unknown key or endpoint is a 404,
// anything else a 500.

const OK = 200;
const NOT_FOUND = 404;
const INTERNAL = 500;
const DISH_PATH = /^\/v1\/dishes\/([a-z0-9-]+)$/;
const REGION_PATH = /^\/v1\/regions\/([a-z0-9-]+)$/;
const RECIPE_PATH = /^\/v1\/dishes\/([a-z0-9-]+)\/variations\/([a-z0-9-]+)\/recipe$/;

export type DishPhotos = Record<string, Photos>;

export function catalogBackend(photos: DishPhotos): RequestListener {
	const source = createMockSource(bundle as ContentBundle);
	return (req, res) => {
		answer(source, photos, req)
			.then((body) => sendJson(res, body))
			.catch((err: unknown) => sendJson(res, problem(err), statusOf(err)));
	};
}

async function answer(source: CatalogSource, photos: DishPhotos, req: IncomingMessage) {
	const url = new URL(req.url ?? '/', 'http://backend');
	const lang = (url.searchParams.get('lang') ?? 'en') as Lang;
	const withPhotos = (dish: Dish): Dish => ({ ...dish, photos: photos[dish.key] ?? dish.photos });
	if (url.pathname === '/v1/regions') return source.listRegions(lang);
	if (url.pathname === '/v1/dishes') return (await source.listDishes(lang)).map(withPhotos);
	const dishKey = DISH_PATH.exec(url.pathname)?.[1];
	if (dishKey) return withPhotos(await source.getDish(lang, dishKey));
	const regionKey = REGION_PATH.exec(url.pathname)?.[1];
	if (regionKey) return source.getRegion(lang, regionKey);
	const recipe = RECIPE_PATH.exec(url.pathname);
	if (recipe) return source.getRecipe(lang, { dishKey: recipe[1], regionKey: recipe[2] });
	throw new NotFoundError(`no fake for ${url.pathname}`);
}

const statusOf = (err: unknown) => (err instanceof NotFoundError ? NOT_FOUND : INTERNAL);

const problem = (err: unknown) => ({ title: String(err), status: statusOf(err) });

function sendJson(res: ServerResponse, body: unknown, status = OK) {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}
