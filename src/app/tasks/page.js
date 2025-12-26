// pages/projects/index.js (or .jsx)
"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import styles from "./tasks.module.css";

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className={styles.page}>
      {/* Static Background */}
      <div className={styles.pageBackground}>
        <Background />
      </div>

      {/* Navbar moved outside animated container */}
      <Navbar />

      <div className={styles.pageContent}>
        <h1 className={styles.title}>Tasks</h1>     
          <p className={styles.text}>More info is coming soon.</p>
      </div>
    </div>
  );
}
