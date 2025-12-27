"use client";
import React from 'react';
import styles from "./TaskToggle.module.css";

export default function TaskToggle({
  activeCategory = 'personal',
  onCategoryChange,
  className = ""
}) {
  const categories = ['personal', 'work'];

  return (
    <div className={`${styles.toggleContainer} ${className}`.trim()}>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`
            ${styles.toggleButton} 
            ${activeCategory === cat ? styles.active : styles.inactive}
          `.trim()}
          onClick={() => onCategoryChange?.(cat)}
          aria-pressed={activeCategory === cat}
          disabled={activeCategory === cat}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
  );
}