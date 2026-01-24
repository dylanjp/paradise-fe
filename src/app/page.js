"use client";

import styles from "./page.module.css";
import Link from "next/link";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import PrimaryButton from "@/components/PrimaryButton";
import BackendErrorOverlay from "@/components/BackendErrorOverlay";
import useBackendHealth from "@/hooks/useBackendHealth";
import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const navbarRef = useRef(null);
  const router = useRouter();
  const { isHealthy, isLoading, isRetrying, retry } = useBackendHealth();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Function to detect viewport width changes
    const detectViewportWidth = () => {
      const width = window.innerWidth;
      setIsMobile(width < 710);
    };

    // Handle initial load viewport detection
    detectViewportWidth();

    // Add event listener for window resize events
    window.addEventListener("resize", detectViewportWidth);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("resize", detectViewportWidth);
    };
  }, []);

  // Show loading indicator during initial health check
  if (isLoading) {
    return (
      <div className={styles.page}>
        <Background />
        <main className={styles.main}>
          <div className={styles.loadingIndicator}>
            <span className={styles.loadingText}>Checking backend status...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar ref={navbarRef} />
      <Background />
      {/* Show error overlay when backend is down */}
      {isHealthy === false && (
        <BackendErrorOverlay isRetrying={isRetrying} onRetry={retry} />
      )}
      <main className={styles.main}>
        <h1 className={styles.retroName}>P.A.R.A.D.I.S.E</h1>
        <h3 className={styles.retroSubTitle}>
          Pratt's Automated Residential And Data Integration System Engine
        </h3>
        <div className={styles.ctas}>
          {authLoading ? null : !isAuthenticated ? (
            // Not logged in - show Login button
            <PrimaryButton
              onClick={() => router.push('/login')}
              disabled={isHealthy === false}
            >
              Login
            </PrimaryButton>
          ) : !isMobile ? (
            // Desktop navigation - show all CTA links
            <>
              {/* <Link href="./projects/" className={styles.navLink}>My Drive</Link> Access to Shared Folder*/}
              <Link href="./tasks/" className={`${styles.navLink} ${isHealthy === false ? styles.disabledLink : ''}`}>
                Task Management
              </Link>
              <Link href="./notifications/manage" className={`${styles.navLink} ${isHealthy === false ? styles.disabledLink : ''}`}>
                Notification Manager
              </Link>
              <Link href="./drive/" className={`${styles.navLink} ${isHealthy === false ? styles.disabledLink : ''}`}>
                Pratt Drive
              </Link>
              <Link href="./home/" className={`${styles.navLink} ${isHealthy === false ? styles.disabledLink : ''}`}>
                Documentation
              </Link>
              <Link href="./comingsoon/" className={`${styles.navLink} ${isHealthy === false ? styles.disabledLink : ''}`}>
                Print Center
              </Link>
            </>
          ) : (
            // Mobile navigation - show PrimaryButton
            <PrimaryButton
              className={`${styles.mobileNavButton} ${isHealthy === false ? styles.disabledLink : ''}`}
              onClick={() => {
                navbarRef.current?.openMenu();
              }}
              disabled={isHealthy === false}
            >
              Tap Here
            </PrimaryButton>
          )}
        </div>
      </main>
    </div>
  );
}
