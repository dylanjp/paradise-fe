"use client";

/**
 * Health Portal Layout
 * Wraps all /health/* routes with shared chrome, auth protection,
 * and the HealthContext provider.
 *
 * Requirements: 1.7, 1.4, 10.1, 10.5, 10.7
 */

import RouteGuard from "@/components/RouteGuard";
import { HealthProvider } from "@/src/context/HealthContext";
import HealthStatusBar from "@/components/HealthStatusBar";
import ParticleBackground from "@/components/ParticleBackground";
import CustomCursor from "@/components/CustomCursor";
import ClickRipple from "@/components/ClickRipple";
import PageTransition from "@/components/PageTransition";
import styles from "./health.module.css";

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - Page content
 */
export default function HealthLayout({ children }) {
  return (
    <RouteGuard>
      <HealthProvider>
        <div className={styles.healthRoot}>
          <ParticleBackground />
          <CustomCursor />
          <ClickRipple />
          <HealthStatusBar />
          <PageTransition>
            <div className={styles.content}>{children}</div>
          </PageTransition>
        </div>
      </HealthProvider>
    </RouteGuard>
  );
}
