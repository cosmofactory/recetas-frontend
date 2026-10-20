// Mobile README -> Screen 2/3: the top bar changes "once scrolled past" its
// threshold. Strictly past, as the prototypes compare (`scrollTop > 230`);
// rubber-band overscroll (negative) never is.
export function isPastThreshold(scrollY: number, threshold: number): boolean {
	return scrollY > threshold;
}
