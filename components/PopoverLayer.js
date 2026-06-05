"use client";
import useViewportPosition from "@/src/lib/useViewportPosition";

/**
 * Renders its children as a fixed-position popover anchored at the given
 * (x, y) viewport coordinates, clamped so it never spills off screen. Shares
 * the same positioning behaviour as the drive context menu for consistency.
 */
export default function PopoverLayer({ x, y, children }) {
  const [ref, position] = useViewportPosition(x, y);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 999,
      }}
    >
      {children}
    </div>
  );
}
