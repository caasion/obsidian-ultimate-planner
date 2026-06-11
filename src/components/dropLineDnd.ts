/**
 * Drop-line drag and drop action for Svelte.
 * Shows a visual indicator line at the drop position instead of shifting items during drag.
 * Reorders only on drop.
 */

export interface DropLineDndOptions<T> {
	items: T[];
	/** CSS selector for the drag handle inside each item. Required. */
	handleSelector: string;
	/** Color for the drop indicator line */
	lineColor?: string;
	/** 'vertical' for column layouts, 'auto' detects from flex-wrap */
	direction?: 'vertical' | 'auto';
	onFinalize: (reorderedItems: T[], fromIndex: number, toIndex: number) => void;
}

interface DragState {
	dragging: boolean;
	draggedEl: HTMLElement | null;
	draggedIndex: number;
	dropLine: HTMLElement | null;
	dropIndex: number;
	clone: HTMLElement | null;
	offsetX: number;
	offsetY: number;
	containerRect: DOMRect | null;
	itemRects: DOMRect[];
	savedPosition: string;
}

function createInitialState(): DragState {
	return {
		dragging: false,
		draggedEl: null,
		draggedIndex: -1,
		dropLine: null,
		dropIndex: -1,
		clone: null,
		offsetX: 0,
		offsetY: 0,
		containerRect: null,
		itemRects: [],
		savedPosition: '',
	};
}

export function dropLineDnd<T>(node: HTMLElement, initialOptions: DropLineDndOptions<T>) {
	let options = initialOptions;
	let state = createInitialState();

	// Bound references for document listeners (so we can remove them)
	let boundMove: ((e: PointerEvent) => void) | null = null;
	let boundUp: ((e: PointerEvent) => void) | null = null;

	function getChildren(): HTMLElement[] {
		return Array.from(node.children).filter(
			(el): el is HTMLElement =>
				el.instanceOf(HTMLElement) &&
				!el.classList.contains('dnd-drop-line') &&
				!el.classList.contains('dnd-drag-clone')
		);
	}

	function getItemRects(): DOMRect[] {
		return getChildren().map(el => el.getBoundingClientRect());
	}

	function isVerticalLayout(): boolean {
		if (options.direction === 'vertical') return true;
		if (options.direction === 'auto') {
			const style = getComputedStyle(node);
			const isRow = style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
			const wraps = style.flexWrap === 'wrap' || style.flexWrap === 'wrap-reverse';
			if (isRow && wraps) return false;
		}
		return true;
	}

	function computeDropIndex(clientX: number, clientY: number, rects: DOMRect[], isVertical: boolean): number {
		if (rects.length === 0) return 0;

		if (isVertical) {
			for (let i = 0; i < rects.length; i++) {
				const midY = rects[i].top + rects[i].height / 2;
				if (clientY < midY) return i;
			}
			return rects.length;
		} else {
			for (let i = 0; i < rects.length; i++) {
				const midX = rects[i].left + rects[i].width / 2;
				if (clientY >= rects[i].top && clientY <= rects[i].bottom) {
					if (clientX < midX) return i;
				} else if (clientY < rects[i].top) {
					return i;
				}
			}
			return rects.length;
		}
	}

	function positionDropLine(dropIndex: number, rects: DOMRect[], containerRect: DOMRect, isVertical: boolean) {
		const line = state.dropLine;
		if (!line) return;

		const color = options.lineColor || 'var(--interactive-accent)';

		if (isVertical) {
			let top: number;
			if (dropIndex === 0) {
				top = rects.length > 0 ? rects[0].top - containerRect.top - 1 : 0;
			} else if (dropIndex >= rects.length) {
				const last = rects[rects.length - 1];
				top = last.bottom - containerRect.top + 1;
			} else {
				const above = rects[dropIndex - 1];
				const below = rects[dropIndex];
				top = (above.bottom + below.top) / 2 - containerRect.top;
			}
			line.style.cssText = `
				position: absolute;
				pointer-events: none;
				z-index: 1000;
				height: 2px;
				left: 0;
				right: 0;
				background: ${color};
				border-radius: 1px;
				top: ${top}px;
				transition: top 80ms ease;
			`;
		} else {
			let left: number;
			let top: number;
			let height: number;
			if (dropIndex === 0 && rects.length > 0) {
				left = rects[0].left - containerRect.left - 1;
				top = rects[0].top - containerRect.top;
				height = rects[0].height;
			} else if (dropIndex >= rects.length) {
				const last = rects[rects.length - 1];
				left = last.right - containerRect.left + 1;
				top = last.top - containerRect.top;
				height = last.height;
			} else {
				const before = rects[dropIndex - 1];
				const after = rects[dropIndex];
				if (Math.abs(before.top - after.top) < before.height / 2) {
					left = (before.right + after.left) / 2 - containerRect.left;
					top = after.top - containerRect.top;
					height = after.height;
				} else {
					left = after.left - containerRect.left - 1;
					top = after.top - containerRect.top;
					height = after.height;
				}
			}
			line.style.cssText = `
				position: absolute;
				pointer-events: none;
				z-index: 1000;
				width: 2px;
				background: ${color};
				border-radius: 1px;
				left: ${left}px;
				top: ${top}px;
				height: ${height}px;
				transition: left 80ms ease, top 80ms ease;
			`;
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (state.dragging) return;

		const target = e.target as HTMLElement;
		const handle = target.closest(options.handleSelector);
		if (!handle) return;

		// Find the direct child item that contains the handle
		const children = getChildren();
		const itemEl = children.find(child => child.contains(handle));
		if (!itemEl) return;

		const itemIndex = children.indexOf(itemEl);
		if (itemIndex === -1) return;

		e.preventDefault();
		e.stopPropagation();

		const rect = itemEl.getBoundingClientRect();
		state.offsetX = e.clientX - rect.left;
		state.offsetY = e.clientY - rect.top;
		state.draggedEl = itemEl;
		state.draggedIndex = itemIndex;

		const startX = e.clientX;
		const startY = e.clientY;
		let started = false;

		boundMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;

			if (!started) {
				if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
				started = true;
				startDrag(itemEl, itemIndex, moveEvent);
			}

			moveDrag(moveEvent);
		};

		boundUp = (_upEvent: PointerEvent) => {
			removeDocListeners();
			if (started) {
				endDrag();
			} else {
				cleanup();
			}
		};

		activeDocument.addEventListener('pointermove', boundMove);
		activeDocument.addEventListener('pointerup', boundUp);
	}

	function removeDocListeners() {
		if (boundMove) activeDocument.removeEventListener('pointermove', boundMove);
		if (boundUp) activeDocument.removeEventListener('pointerup', boundUp);
		boundMove = null;
		boundUp = null;
	}

	function startDrag(itemEl: HTMLElement, index: number, e: PointerEvent) {
		state.dragging = true;

		// Ensure container is positioned for absolute drop-line
		const containerPosition = getComputedStyle(node).position;
		state.savedPosition = containerPosition;
		if (containerPosition === 'static') {
			node.classList.add('dnd-container-relative');
		}

		// Capture rects after positioning is set so layout is stable
		state.containerRect = node.getBoundingClientRect();
		state.itemRects = getItemRects();

		// Create floating clone
		const clone = itemEl.cloneNode(true) as HTMLElement;
		clone.className += ' dnd-drag-clone';
		const rect = itemEl.getBoundingClientRect();
		clone.style.cssText = `
			position: fixed;
			width: ${rect.width}px;
			height: ${rect.height}px;
			left: ${e.clientX - state.offsetX}px;
			top: ${e.clientY - state.offsetY}px;
			z-index: 10000;
			pointer-events: none;
			opacity: 0.9;
			box-shadow: 0 4px 16px rgba(0,0,0,0.25);
			border-radius: 8px;
			background: var(--background-primary);
		`;
		activeDocument.body.appendChild(clone);
		state.clone = clone;

		// Dim original item (keep in layout)
		itemEl.classList.add('dnd-dragged-item');

		// Create drop line
		const line = activeDocument.createElement('div');
		line.className = 'dnd-drop-line';
		node.appendChild(line);
		state.dropLine = line;

		// Position at current index
		state.dropIndex = index;
		positionDropLine(index, state.itemRects, state.containerRect, isVerticalLayout());
	}

	function moveDrag(e: PointerEvent) {
		if (!state.dragging || !state.clone || !state.containerRect) return;

		state.clone.style.left = `${e.clientX - state.offsetX}px`;
		state.clone.style.top = `${e.clientY - state.offsetY}px`;

		const isV = isVerticalLayout();
		const newDropIndex = computeDropIndex(e.clientX, e.clientY, state.itemRects, isV);
		if (newDropIndex !== state.dropIndex) {
			state.dropIndex = newDropIndex;
			positionDropLine(newDropIndex, state.itemRects, state.containerRect, isV);
		}
	}

	function endDrag() {
		if (!state.dragging) return;

		const fromIndex = state.draggedIndex;
		let toIndex = state.dropIndex;

		// If dropping after original position, the visual gap index is 1 higher
		// than the final array index because the source item is still in the array.
		if (toIndex > fromIndex) {
			toIndex = toIndex - 1;
		}

		cleanup();

		if (fromIndex !== toIndex && toIndex >= 0 && toIndex < options.items.length) {
			const reordered = [...options.items];
			const [moved] = reordered.splice(fromIndex, 1);
			reordered.splice(toIndex, 0, moved);
			options.onFinalize(reordered, fromIndex, toIndex);
		}
	}

	function cleanup() {
		if (state.draggedEl) {
			state.draggedEl.classList.remove('dnd-dragged-item');
		}
		if (state.clone) {
			state.clone.remove();
		}
		if (state.dropLine) {
			state.dropLine.remove();
		}
		if (state.savedPosition === 'static') {
			node.classList.remove('dnd-container-relative');
		}
		removeDocListeners();
		state = createInitialState();
	}

	node.addEventListener('pointerdown', onPointerDown);

	return {
		update(newOptions: DropLineDndOptions<T>) {
			options = newOptions;
		},
		destroy() {
			cleanup();
			node.removeEventListener('pointerdown', onPointerDown);
		}
	};
}
