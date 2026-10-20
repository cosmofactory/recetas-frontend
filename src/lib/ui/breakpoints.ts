// F6: the one layout breakpoint (desktop from 860px). Script code branches on
// desktopQuery (MediaQuery / matchMedia), never on a copied number.
export const DESKTOP_MIN_WIDTH_PX = 860;

export const desktopQuery = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;
