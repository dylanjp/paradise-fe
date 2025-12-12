// pages/projects/index.js (or .jsx)
"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import ProjectCard from "@/components/ProjectCard";
import ProjectModal from "@/components/ProjectModal";
import projectsData from "@/data/projectsData"; // Adjust path as needed
import styles from "./projects.module.css";

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div className={styles.page}>
      {/* Static Background */}
      <div className={styles.pageBackground}><Background /></div>

      {/* Navbar moved outside animated container */}
      <Navbar />
      
      <div className={styles.pageContent}>
        <h1 className={styles.title}>Projects</h1>

        {projectsData.length > 0 ? (
          <div className={styles.grid}>
            {projectsData.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={setSelectedProject}
                index={index} // Pass index for staggered animation
              />
            ))}
          </div>
        ) : (
          <p className={styles.text}>More info is coming soon.</p>
        )}

        {selectedProject && (
          <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
        )}
      </div>
    </div>
  );
}
