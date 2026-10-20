// WAI-ARIA tabs keyboard model: ArrowLeft / ArrowRight move to the previous /
// next tab, wrapping at the ends; Home / End go to the first / last. Any
// other key is not the tablist's (undefined).
export function tabIndexForKey(key: string, current: number, count: number): number | undefined {
	switch (key) {
		case 'ArrowRight':
			return (current + 1) % count;
		case 'ArrowLeft':
			return (current - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return undefined;
	}
}
