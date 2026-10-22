const MINUTES_PER_HOUR = 60;

// An ISO 8601 duration from whole minutes, hours and minutes only ("PT1H15M";
// schema.org and Google read "PT25H", so there is no day part). The API
// guarantees a non-negative integer, so anything else is a contract violation.
export function isoDuration(minutes: number): string {
	if (!Number.isInteger(minutes) || minutes < 0) {
		throw new RangeError(`isoDuration: want whole non-negative minutes, got ${minutes}`);
	}
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	const rest = minutes % MINUTES_PER_HOUR;
	if (hours === 0) return `PT${rest}M`;
	return rest === 0 ? `PT${hours}H` : `PT${hours}H${rest}M`;
}
