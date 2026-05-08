"use client";

import { useEffect, useRef, useCallback } from "react";
import styles from "./ClickRipple.module.css";

/**
 * No props — attaches click listener to document.
 * On click, creates an absolutely positioned <span> at click coordinates
 * with a CSS scale(0) → scale(1) + opacity 1 → 0 animation (400ms).
 * Removes the element after animation completes.
 */
export default function ClickRipple() {
  const containerRef = useRef(null);

  const handleClick = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;

    const ripple = document.createElement("span");
    ripple.className = styles.ripple;
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;

    container.appendChild(ripple);

    // Remove the ripple element after animation completes (400ms)
    ripple.addEventListener("animationend", () => {
      ripple.remove();
    });
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [handleClick]);

  return (
    <div ref={containerRef} className={styles.container} aria-hidden="true" />
  );
}
