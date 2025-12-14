// components/ProjectModal.js
"use client";
import { useEffect } from "react";
import styles from "./ProjectModal.module.css";
import PrimaryButton from "./PrimaryButton";
import TechnologyTag from "./TechnologyTag";

export default function ProjectModal({ project, onClose }) {
  const handleClose = () => {
    onClose();
  };

  // Optionally play a sound on modal open
  useEffect(() => {}, []);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <img
          src={project.image}
          alt={project.title}
          className={styles.modalImage}
        />
        <h2 className={styles.modalTitle}>{project.title}</h2>
        {/* Technology Tags Section */}
        {project.technologies && project.technologies.length > 0 && (
          <div className={styles.technologySection}>
            <div className={styles.technologyTags}>
              {project.technologies.map((tech, index) => (
                <TechnologyTag
                  key={index}
                  name={tech.name}
                  color={tech.color}
                />
              ))}
            </div>
          </div>
        )}
        <p className={styles.modalDescription}>{project.description}</p>
        <div className={styles.buttonRow}>
          {project.link ? (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.learnMoreButton}
            >
              Learn More
            </a>
          ) : (
            <div className={styles.comingSoonBanner}>More Info Coming Soon</div>
          )}
          <PrimaryButton onClick={handleClose} className={styles.closeButton}>
            Close
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
