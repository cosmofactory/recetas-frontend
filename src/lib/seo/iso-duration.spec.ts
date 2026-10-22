import { describe, expect, it } from 'vitest';
import { loadExport } from '../../testutil/load-export';

// FE-8 PR 2 (stage FE-8 -> SEO, JSON-LD Recipe: "totalTime (ISO 8601 from
// minutes)"). `isoDuration(minutes)` in #lib/seo/iso-duration.ts turns the
// API's timeMinutes into an ISO 8601 duration: hours and minutes only (no
// day part; Google and schema.org read PT25H), a zero part left out, and
// PT0M for zero. A negative or fractional minute count is a contract
// violation and throws.

type IsoDuration = (minutes: number) => string;

const MODULE = 'src/lib/seo/iso-duration.ts';
const isoDuration = () => loadExport<IsoDuration>(MODULE, 'isoDuration');

describe('isoDuration', () => {
	const cases: { minutes: number; want: string }[] = [
		{ minutes: 0, want: 'PT0M' },
		{ minutes: 5, want: 'PT5M' },
		{ minutes: 25, want: 'PT25M' },
		{ minutes: 59, want: 'PT59M' },
		{ minutes: 60, want: 'PT1H' },
		{ minutes: 75, want: 'PT1H15M' },
		{ minutes: 90, want: 'PT1H30M' },
		{ minutes: 180, want: 'PT3H' },
		{ minutes: 600, want: 'PT10H' },
		{ minutes: 1500, want: 'PT25H' },
		{ minutes: 1501, want: 'PT25H1M' }
	];
	for (const { minutes, want } of cases) {
		it(`${minutes} min -> ${want}`, async () => {
			const got = (await isoDuration())(minutes);
			expect(got, `got ${got}, want ${want}`).toBe(want);
		});
	}

	for (const minutes of [-1, 1.5, Number.NaN]) {
		it(`${minutes} min throws`, async () => {
			const fn = await isoDuration();
			expect(() => fn(minutes)).toThrow();
		});
	}
});
