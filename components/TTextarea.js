"use client";
import styles from "./TTextarea.module.css";

/**
 * Styled textarea for the Health Portal.
 *
 * @param {object} props
 * @param {string} props.id - Textarea id (for label association)
 * @param {string} [props.label] - Label text
 * @param {string} [props.error] - Inline validation error message
 * @param {string} [props.className]
 * @param {number} [props.rows] - Number of visible text rows
 * @param {...any} rest - Passed to underlying <textarea>
 */
export default function TTextarea({ id, label, error, className, rows, ...rest }) {
  const errorId = `${id}-error`;

  const textareaClasses = [
    styles.textarea,
    error ? styles.textareaError : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={textareaClasses}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
