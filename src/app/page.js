"use client";

import styles from "./page.module.css";
import Link from "next/link";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import PrimaryButton from "@/components/PrimaryButton";
import { useEffect, useState, useRef } from "react";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const navbarRef = useRef(null);

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

  return (
    <div className={styles.page}>
      <Navbar ref={navbarRef} />
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
              <Link href="./tasks/" className={styles.navLink}>
                Task Management
              </Link>
              <Link href="./comingsoon/" className={styles.navLink}>
                Notification Manager
              </Link>
              <Link href="./drive/" className={styles.navLink}>
                Pratt Drive
              </Link>
              <Link href="./home/" className={styles.navLink}>
                Documentation
              </Link>
              <Link href="./comingsoon/" className={styles.navLink}>
                Print Center
              </Link>
            </>
          ) : (
            // Mobile navigation - show PrimaryButton
            <PrimaryButton
              className={styles.mobileNavButton}
              onClick={() => {
                navbarRef.current?.openMenu();
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
