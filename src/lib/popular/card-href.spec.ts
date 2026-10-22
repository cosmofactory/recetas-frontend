import { describe, expect, it } from 'vitest';
import { dishCardHref } from './card-href.ts';

const ORIGIN = 'https://asadorov.test';
const url = (pathAndQuery: string) => new URL(pathAndQuery, ORIGIN);

describe('dishCardHref', () => {
	it('mobile: the dish sheet URL, keeping the filters in canonical order', () => {
		const href = dishCardHref(url('/es/?tab=popular&f=summer&f=vegetarian'), 'gazpacho', 'mobile');
		expect(href).toBe('/es/?tab=popular&f=vegetarian&f=summer&dish=gazpacho');
	});

	it('mobile: drops any other param, including an open dish', () => {
		const href = dishCardHref(url('/en/?tab=popular&dish=paella&utm=x'), 'tortilla', 'mobile');
		expect(href).toBe('/en/?tab=popular&dish=tortilla');
	});

	it('desktop: the Variations page in the URL locale, without the filters', () => {
		const href = dishCardHref(url('/ru/?tab=popular&f=pork&dish=cocido'), 'paella', 'desktop');
		expect(href).toBe('/ru/dishes/paella');
	});
});
