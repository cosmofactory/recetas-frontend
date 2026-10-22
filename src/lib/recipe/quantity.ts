import { formatNumber, unitLabel, type Unit } from '#lib/i18n/format.ts';

// g/ml round to the nearest 10 and never show below it (FE-6 small decisions).
const METRIC_STEP = 10;
// From 1000 g/ml the quantity switches to kg/L.
const METRIC_SWITCH = 1000;
// Counted units round to the nearest ½.
const HALVES_PER_UNIT = 2;
const HALF_GLYPH = '½';
// A tsp that rounds to 0 is lifted to 1, and bare counts (eggs) never show below 1.
const MIN_COUNT = 1;

type MetricUnit = 'g' | 'ml';
const LARGE_METRIC_UNIT: Record<MetricUnit, Unit> = { g: 'kg', ml: 'L' };

export function scaleQuantity(quantity: number, baseServings: number, servings: number): number {
	if (baseServings <= 0) {
		throw new Error(`scaleQuantity: baseServings must be positive, got ${baseServings}`);
	}
	return (quantity * servings) / baseServings;
}

export function formatQuantity(locale: string, value: number, unit: string | null): string {
	if (unit === null) return formatBareCount(locale, value);
	if (isMetricUnit(unit)) return formatMetric(locale, value, unit);
	return `${formatHalves(locale, roundedCount(value))} ${unitLabel(locale, unit)}`;
}

function isMetricUnit(unit: string): unit is MetricUnit {
	return Object.hasOwn(LARGE_METRIC_UNIT, unit);
}

// Rounding to 10 only decides the switch; the kg/L decimal comes from the raw
// value, so 1249 g is "1.2 kg" rather than 1250 -> "1.3 kg".
function formatMetric(locale: string, value: number, unit: MetricUnit): string {
	const rounded = Math.max(METRIC_STEP, Math.round(value / METRIC_STEP) * METRIC_STEP);
	if (rounded < METRIC_SWITCH) return `${formatNumber(locale, rounded)} ${unitLabel(locale, unit)}`;
	const large = LARGE_METRIC_UNIT[unit];
	return `${formatNumber(locale, value / METRIC_SWITCH)} ${unitLabel(locale, large)}`;
}

function formatBareCount(locale: string, value: number): string {
	return formatHalves(locale, Math.max(MIN_COUNT, roundedCount(value)));
}

function roundedCount(value: number): number {
	const halves = Math.round(value * HALVES_PER_UNIT) / HALVES_PER_UNIT;
	return halves === 0 ? MIN_COUNT : halves;
}

function formatHalves(locale: string, count: number): string {
	const whole = Math.floor(count);
	if (whole === count) return formatNumber(locale, whole);
	if (whole === 0) return HALF_GLYPH;
	return `${formatNumber(locale, whole)}${HALF_GLYPH}`;
}
