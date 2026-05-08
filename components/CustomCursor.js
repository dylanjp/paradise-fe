"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CustomCursor.module.css";

/**
 * Two-element TRON cursor: a 4px dot and a 32px ring, both co-centered on the
 * pointer. Positioned via top/left for unambiguous placement (transform-based
 * centering produced visible offsets in some browsers).
 * Disabled on touch-only devices and when prefers-reduced-motion is set.
 */
export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isTouchOnly =
      "ontouchstart" in window &&
      !window.matchMedia("(pointer: fine)").matches;
    if (isTouchOnly) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    setEnabled(true);

    const DOT_HALF = 2;
    const RING_HALF = 16;

    function handleMouseMove(e) {
      const x = e.clientX;
      const y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.left = `${x - DOT_HALF}px`;
        dotRef.current.style.top = `${y - DOT_HALF}px`;
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${x - RING_HALF}px`;
        ringRef.current.style.top = `${y - RING_HALF}px`;
      }
    }

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <div ref={dotRef} className={styles.dot} aria-hidden="true" />
      <div ref={ringRef} className={styles.ring} aria-hidden="true" />
    </>
  );
}
