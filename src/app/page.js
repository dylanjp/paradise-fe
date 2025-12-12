"use client";

import styles from "./page.module.css";
import Link from "next/link";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
  }, []);

  return (
    <div className={styles.page}>
      <Navbar />
      <Background />
      <main className={styles.main}>
        <h1 className={styles.retroName}>P.A.R.A.D.I.S.E</h1>
        <h3 className={styles.retroSubTitle}>Pratt’s Automated Residential And Data Integration System Engine</h3>
        <div className={styles.ctas}>
          <Link href="./projects/" className={styles.navLink}>Task Management</Link>
          <Link href="./blog/" className={styles.navLink}>House Management</Link>
          <Link href="./projects/" className={styles.navLink}>Notification Manager</Link>
          {/* <Link href="./resume/" className={styles.navLink}>Resume</Link>
          <Link href="./about/" className={styles.navLink}>About</Link> */}
        </div>
      </main>
    </div>
  );
}