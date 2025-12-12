// components/TechnologyTag.js
"use client";
import styles from "./TechnologyTag.module.css";

/**
 * TechnologyTag component for displaying technology badges
 * @param {string} name - The technology name to display
 * @param {string} color - Optional hex color (defaults to cyan #00ffff)
 * @param {string} size - Size variant: "small", "medium", "large", or "default"
 */
export default function TechnologyTag({ name, color, size = "default" }) {
  // Use default cyan color if no color is provided
  const tagColor = color || "#00ffff";
  
  // Create inline styles for dynamic color application
  const tagStyle = {
    borderColor: tagColor,
    color: tagColor,
    boxShadow: `0 0 8px ${tagColor}`,
    textShadow: `0 0 4px ${tagColor}`
  };

  // Combine base class with size class
  const sizeClass = size !== "default" ? styles[size] : "";
  const className = `${styles.technologyTag} ${sizeClass}`.trim();

  return (
    <span 
      className={className}
      style={tagStyle}
    >
      {name}
    </span>
  );
}