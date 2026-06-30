export interface SwipeableOptions {
	onLeft?: () => void;
	onRight?: () => void;
	threshold?: number;
}

export function swipeable(node: HTMLElement, options: SwipeableOptions) {
	let startX = 0;
	let startY = 0;
	const threshold = options.threshold ?? 50;

	function handleTouchStart(e: TouchEvent) {
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const deltaX = e.changedTouches[0].clientX - startX;
		const deltaY = e.changedTouches[0].clientY - startY;
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
			if (deltaX > 0) options.onRight?.();
			else options.onLeft?.();
		}
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchend', handleTouchEnd, { passive: true });

	return {
		update(newOptions: SwipeableOptions) {
			options = newOptions;
		},
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchend', handleTouchEnd);
		}
	};
}
