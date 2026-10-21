type ClickLike = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

const PRIMARY_BUTTON = 0;

// A link click the app may take over: the primary button with no modifier.
// Any other (new tab, new window, download) stays the browser's.
export const isPlainClick = (event: ClickLike): boolean =>
	event.button === PRIMARY_BUTTON &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;
