// Escape closes the topmost shown layer only (mobile README -> Filters sheet:
// "Overlay above everything"), whether layers are siblings or nested and in
// whatever order they were shown. One document listener in the bubble phase,
// so an Escape an inner control already handled (defaultPrevented) is left
// alone, and the one handled here is marked for anything further out.

export type EscapeLayerKind = 'sheet' | 'overlay';

const LAYER_ORDER: Record<EscapeLayerKind, number> = { sheet: 0, overlay: 1 };

type Layer = { order: number; onEscape: () => void };

const layers: Layer[] = [];

// The highest kind wins; among equals, the one shown last.
function topmost(): Layer | undefined {
	return layers.reduce<Layer | undefined>(
		(top, layer) => (!top || layer.order >= top.order ? layer : top),
		undefined
	);
}

function onKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || event.defaultPrevented) return;
	const top = topmost();
	if (!top) return;
	event.preventDefault();
	top.onEscape();
}

// Registers a shown layer; the returned function removes it once hidden.
export function pushEscapeLayer(kind: EscapeLayerKind, onEscape: () => void): () => void {
	const layer = { order: LAYER_ORDER[kind], onEscape };
	if (layers.length === 0) document.addEventListener('keydown', onKeydown);
	layers.push(layer);
	return () => {
		const index = layers.indexOf(layer);
		if (index >= 0) layers.splice(index, 1);
		if (layers.length === 0) document.removeEventListener('keydown', onKeydown);
	};
}
