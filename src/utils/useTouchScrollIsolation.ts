import { RefObject, useEffect } from "react";

export interface TouchScrollIsolationOptions {
  /** Re-attaches listeners cleanly when panel mounts/unmounts (e.g. tab switch). */
  enabled?: boolean;
  /**
   * When true (default), allows scrolling inside vertically scrollable elements
   * contained within the panel while strictly blocking outer page scroll chaining
   * at top/bottom boundaries or on non-scrollable surfaces.
   */
  allowInnerScroll?: boolean;
}

function isElementVerticallyScrollable(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const style = window.getComputedStyle(el);
  const oy = style.overflowY;
  return oy === "auto" || oy === "scroll" || oy === "overlay";
}

function isElementHorizontallyScrollable(el: HTMLElement): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const style = window.getComputedStyle(el);
  const ox = style.overflowX;
  return ox === "auto" || ox === "scroll" || ox === "overlay";
}

/**
 * Isolates mobile touch-scroll gestures strictly inside a studio workbench panel.
 * Prevents iOS Safari / Android Chrome scroll chaining and pull-to-refresh from
 * dragging the outer document while keeping Cropper pan/pinch, range sliders,
 * horizontal quick-step bars, and inner vertical scrolling fluid.
 */
export function useTouchScrollIsolation(
  containerRef: RefObject<HTMLElement | null>,
  options: TouchScrollIsolationOptions = {}
) {
  const { enabled = true, allowInnerScroll = true } = options;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let isMultiTouch = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        isMultiTouch = true;
        return;
      }
      isMultiTouch = false;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      lastX = t.clientX;
      lastY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.cancelable) return;

      const target = e.target as HTMLElement | null;

      // Let react-easy-crop handle single-finger pan & two-finger pinch natively
      // (its wrapper already uses touch-action: none to prevent page scrolling).
      if (target && target.closest(".reactEasyCrop_Container")) {
        return;
      }

      if (isMultiTouch || e.touches.length !== 1) {
        return;
      }

      const t = e.touches[0];
      const currentX = t.clientX;
      const currentY = t.clientY;
      const stepX = currentX - lastX;
      const stepY = currentY - lastY;
      const totalX = currentX - startX;
      const totalY = currentY - startY;

      lastX = currentX;
      lastY = currentY;

      // Ignore micro-jitter during normal taps so buttons/inputs stay crisp
      if (Math.abs(stepX) < 0.5 && Math.abs(stepY) < 0.5) {
        return;
      }

      const isHorizontalIntent = Math.abs(totalX) > Math.abs(totalY);

      // Keep native range slider dragging fluid when dragging horizontally
      if (target && target.closest('input[type="range"]') && isHorizontalIntent) {
        return;
      }

      // Allow horizontal swipe inside overflow-x-auto strips (e.g. Quick-Step bar)
      if (isHorizontalIntent) {
        let node: HTMLElement | null = target;
        while (node) {
          if (isElementHorizontallyScrollable(node)) {
            const swipingRight = stepX > 0;
            const swipingLeft = stepX < 0;
            const canScrollLeft = node.scrollLeft > 0;
            const canScrollRight =
              node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
            if ((swipingRight && canScrollLeft) || (swipingLeft && canScrollRight)) {
              return;
            }
          }
          if (node === container) break;
          node = node.parentElement;
        }
        // Strictly block horizontal overscroll bounce when no horizontal strip can move
        e.preventDefault();
        return;
      }

      // Vertical swipe: allow ONLY if an inner scrollable box (or the panel itself)
      // still has room to scroll in the finger's movement direction.
      if (allowInnerScroll) {
        const swipingDown = stepY > 0; // moving finger down -> scrolls content toward top (0)
        const swipingUp = stepY < 0; // moving finger up -> scrolls content toward bottom

        let node: HTMLElement | null = target;
        while (node) {
          if (isElementVerticallyScrollable(node)) {
            const canScrollUp = node.scrollTop > 0;
            const canScrollDown =
              node.scrollTop + node.clientHeight < node.scrollHeight - 1;

            if ((swipingDown && canScrollUp) || (swipingUp && canScrollDown)) {
              return;
            }
          }
          if (node === container) break;
          node = node.parentElement;
        }
      }

      // At boundary or non-scrollable surface: strictly block outer page scroll
      e.preventDefault();
    };

    const onTouchEnd = () => {
      isMultiTouch = false;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, enabled, allowInnerScroll]);
}
