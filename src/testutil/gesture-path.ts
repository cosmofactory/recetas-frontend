// How a pointer travels between two points, shared by real-input.ts
// (Vitest browser mode, CDP) and segmented-switch-e2e.ts (Playwright). No
// imports, so both runtimes load it.

export type Point = { x: number; y: number };

// Px per event and a pause after each, so a gesture can be paced (slow) or a
// flick (big steps, no pause).
export type Pace = { stepPx?: number; pauseMs?: number };

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The points after `from` up to `to`, at most `stepPx` apart on either axis.
export function pathPoints(from: Point, to: Point, stepPx: number): Point[] {
	const travel = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
	const count = Math.max(1, Math.ceil(travel / stepPx));
	return Array.from({ length: count }, (_, i) => ({
		x: from.x + ((to.x - from.x) * (i + 1)) / count,
		y: from.y + ((to.y - from.y) * (i + 1)) / count
	}));
}

// Sends each point in order, pausing after each when the pace asks for it.
export async function sendPaced(
	points: Point[],
	pace: Pace,
	send: (point: Point) => Promise<unknown>
) {
	for (const point of points) {
		await send(point);
		if (pace.pauseMs) await pause(pace.pauseMs);
	}
}
