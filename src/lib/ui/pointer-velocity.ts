// A pointer's speed as it lets go, from its last few moves (event.timeStamp
// and position along one axis), so an old pause or a slow start doesn't
// count: px/ms, signed like the axis. Measured between the moves, not up to
// the release: the release event can come late (a busy main thread), which
// would slow a flick down.

export type Sample = { time: number; position: number };

// Moves older than this before the last one don't count; a pointer that
// rested this long before letting go has no speed.
const VELOCITY_WINDOW_MS = 100;
// Events in the same millisecond still have a (large) finite speed.
const MIN_ELAPSED_MS = 1;

const within = (sample: Sample, now: number) => now - sample.time <= VELOCITY_WINDOW_MS;

// The samples still worth keeping at `now`, so the list stays short.
export function recentSamples(samples: Sample[], now: number): Sample[] {
	return samples.filter((sample) => within(sample, now));
}

export function releaseVelocity(samples: Sample[], releasedAt: number): number {
	const last = samples.at(-1);
	if (last === undefined || !within(last, releasedAt)) return 0;
	const first = recentSamples(samples, last.time)[0];
	const elapsed = Math.max(last.time - first.time, MIN_ELAPSED_MS);
	return (last.position - first.position) / elapsed;
}
