"use client";

import { usePathname } from "next/navigation";
import styles from "./PageTransition.module.css";

/**
 * Wraps page content with CSS enter/exit animations.
 * Uses the current pathname as a React key so the wrapper remounts
 * on route change, re-triggering the pgIn animation.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export default function PageTransition({ children, className }) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className={`${styles.pgIn}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
