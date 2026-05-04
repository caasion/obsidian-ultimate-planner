/**
 * Svelte action for detecting long press events
 * @param node - The DOM element to attach the action to
 * @param duration - Duration in milliseconds to wait before firing longpress event (default: 500ms)
 */
export function longpress(node: HTMLElement, duration: number = 500) {
    let timer: NodeJS.Timeout;
    let longpressFired = false;

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
        longpressFired = false;
        timer = setTimeout(() => {
            longpressFired = true;
            node.dispatchEvent(new CustomEvent('longpress'));
        }, duration);
    };

    const handleMouseUp = () => {
        clearTimeout(timer);
    };

    const handleClick = (e: MouseEvent) => {
        if (longpressFired) {
            e.stopImmediatePropagation();
            e.preventDefault();
            longpressFired = false;
        }
    };
    
    node.addEventListener('mousedown', handleMouseDown);
    node.addEventListener('mouseup', handleMouseUp);
    node.addEventListener('mouseleave', handleMouseUp);
    node.addEventListener('click', handleClick, true);
    node.addEventListener('touchstart', handleMouseDown);
    node.addEventListener('touchend', handleMouseUp);
    node.addEventListener('touchcancel', handleMouseUp);

    return {
        update(newDuration: number) {
            duration = newDuration;
        },
        destroy() {
            clearTimeout(timer);
            node.removeEventListener('mousedown', handleMouseDown);
            node.removeEventListener('mouseup', handleMouseUp);
            node.removeEventListener('mouseleave', handleMouseUp);
            node.removeEventListener('click', handleClick, true);
            node.removeEventListener('touchstart', handleMouseDown);
            node.removeEventListener('touchend', handleMouseUp);
            node.removeEventListener('touchcancel', handleMouseUp);
        }
    };
}
