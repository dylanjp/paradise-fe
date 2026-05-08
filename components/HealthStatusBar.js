"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { formatStatusDate } from "@/utils/dateFormatter";
import styles from "./HealthStatusBar.module.css";

const ROUTE_TITLES = {
  "/health/": null,
  "/health/journal/": "// DAILY JOURNAL",
  "/health/graphs/": "// HEALTH GRAPHS",
  "/health/documents/": "// HEALTH DOCS",
  "/health/appointments/": "// APPOINTMENTS",
};

/**
 * Fixed top bar on all health screens.
 * Home screen: pulsing cyan dot + portal name.
 * Sub-pages: back button + page title with // prefix.
 * Right side: SYS:ONLINE + date + live clock.
 */
export default function HealthStatusBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const title = ROUTE_TITLES[pathname] ?? ROUTE_TITLES[pathname + "/"] ?? null;
  const isHome = pathname === "/health/" || pathname === "/health";

  const formatClock = (date) => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleBack = () => {
    router.push("/health/");
  };

  const handleExit = () => {
    router.push("/");
  };

  return (
    <header className={styles.bar} role="banner" aria-label="Health Portal status bar">
      <div className={styles.left}>
        <button
          className={styles.backBtn}
          onClick={handleExit}
          aria-label="Exit health portal and return to main home"
        >
          ⌂ MAIN
        </button>
        {isHome ? (
          <>
            <span className={styles.pulsingDot} aria-hidden="true" />
            <span className={styles.portalName}>PRATT HEALTH PORTAL</span>
          </>
        ) : (
          <>
            <button
              className={styles.backBtn}
              onClick={handleBack}
              aria-label="Navigate back to health home"
            >
              ◀ HOME
            </button>
            {title && <span className={styles.pageTitle}>{title}</span>}
          </>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.sysOnline}>SYS:ONLINE</span>
        <span className={styles.separator} aria-hidden="true">|</span>
        <span className={styles.date}>{formatStatusDate(now)}</span>
        <span className={styles.separator} aria-hidden="true">|</span>
        <span className={styles.clock} aria-live="polite" aria-label={`Current time: ${formatClock(now)}`}>
          {formatClock(now)}
        </span>
      </div>
    </header>
  );
}
