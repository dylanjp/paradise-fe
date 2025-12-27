"use client";
import { validateComponentProps, validateCategory } from '../src/lib/taskStateValidation';
import styles from "./TaskToggle.module.css";

export default function TaskToggle({
  activeCategory,
  onCategoryChange,
  className = "",
  ...props
}) {
  // Validate props
  const propsValidation = validateComponentProps(
    { activeCategory, onCategoryChange, className },
    ['activeCategory', 'onCategoryChange']
  );

  if (!propsValidation.isValid) {
    console.error('TaskToggle props validation failed:', propsValidation.errors);
    return (
      <div className={`${styles.toggleContainer} ${styles.errorContainer} ${className}`}>
        <div className={styles.errorText}>Toggle configuration error</div>
      </div>
    );
  }

  // Validate active category
  if (!validateCategory(activeCategory)) {
    console.error('TaskToggle received invalid active category:', activeCategory);
    return (
      <div className={`${styles.toggleContainer} ${styles.errorContainer} ${className}`}>
        <div className={styles.errorText}>Invalid category: {activeCategory}</div>
      </div>
    );
  }

  const classes = `${styles.toggleContainer} ${className}`.trim();

  const handleCategoryClick = (category) => {
    try {
      if (!validateCategory(category)) {
        console.error('TaskToggle: Invalid category clicked:', category);
        return;
      }

      if (onCategoryChange) {
        onCategoryChange(category);
      }
    } catch (error) {
      console.error('TaskToggle: Error during category change:', error);
    }
  };

  return (
    <div className={classes} {...props}>
      <button
        className={`${styles.toggleButton} ${
          activeCategory === 'personal' ? styles.active : styles.inactive
        }`}
        onClick={() => handleCategoryClick('personal')}
        type="button"
        aria-pressed={activeCategory === 'personal'}
        disabled={activeCategory === 'personal'}
      >
        Personal
      </button>
      <button
        className={`${styles.toggleButton} ${
          activeCategory === 'work' ? styles.active : styles.inactive
        }`}
        onClick={() => handleCategoryClick('work')}
        type="button"
        aria-pressed={activeCategory === 'work'}
        disabled={activeCategory === 'work'}
      >
        Work
      </button>
    </div>
  );
}