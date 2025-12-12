// components/ProjectCard.js
"use client";
import styles from "./ProjectCard.module.css";

export default function ProjectCard({ project, onClick }) {
  return (
    <div className={styles.card} onClick={() => onClick(project)}>
      <img src={project.image} alt={project.title} className={styles.cardImage} />
      <h3 className={styles.cardTitle}>{project.title}</h3>
    </div>
  );
}