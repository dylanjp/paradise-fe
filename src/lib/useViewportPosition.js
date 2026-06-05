"use client";
import { useLayoutEffect, useRef, useState } from "react";

const VIEWPORT_MARGIN = 8;

/**
 * Positions a `position: fixed` popover at the requested (x, y) viewport
 * coordinates (e.g. a right-click's clientX/clientY), then clamps it so the
 * element always stays fully on screen and is never cut off near an edge.
 *
 * Returns a tuple of [ref, { left, top }]: attach the ref to the popover
 * element and spread the position onto its inline style.
 */
export default function useViewportPosition(x, y) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth/Height report the layout size, ignoring the open
    // animation's scale() transform, so we clamp against the final size.
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(x, maxLeft)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, maxTop)),
    });
  }, [x, y]);

  return [ref, position];
}
