"use client";

import styles from "./page.module.css";
import Link from "next/link";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import PrimaryButton from "@/components/PrimaryButton";
import { useEffect, useState } from "react";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Function to detect viewport width changes
    const detectViewportWidth = () => {
      const width = window.innerWidth;
      setIsMobile(width < 710);
    };

    // Handle initial load viewport detection
    detectViewportWidth();

    // Add event listener for window resize events
    window.addEventListener('resize', detectViewportWidth);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', detectViewportWidth);
    };
  }, []);

  return (
    <div className={styles.page}>
      <Navbar />
      <Background />
      <main className={styles.main}>
        <h1 className={styles.retroName}>P.A.R.A.D.I.S.E</h1>
        <h3 className={styles.retroSubTitle}>
          Pratt’s Automated Residential And Data Integration System Engine
        </h3>
        <div className={styles.ctas}>
          {!isMobile ? (
            // Desktop navigation - show all CTA links
            <>
              {/* <Link href="./projects/" className={styles.navLink}>My Drive</Link> Access to Shared Folder*/}
              <Link href="./projects/" className={styles.navLink}>
                Task Management
              </Link>
              <Link href="./projects/" className={styles.navLink}>
                Notification Manager
              </Link>
              <Link href="./blog/" className={styles.navLink}>
                House Management
              </Link>
              <Link href="./projects/" className={styles.navLink}>
                Print Center
              </Link>
            </>
          ) : (
            // Mobile navigation - show PrimaryButton
            <PrimaryButton
              className={styles.mobileNavButton}
              onClick={() => {
                // Placeholder for future functionality
                console.log("Mobile navigation button clicked");
              }}
            >
              Tap Here
            </PrimaryButton>
          )}
        </div>
      </main>
    </div>
  );
}
