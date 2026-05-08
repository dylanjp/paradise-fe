"use client";
import styles from "./TSelect.module.css";

/**
 * Styled select dropdown for the Health Portal.
 *
 * @param {object} props
 * @param {string} props.id - Select id (for label association)
 * @param {string} [props.label] - Label text
 * @param {string} [props.error] - Inline validation error message
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children - <option> elements
 * @param {...any} rest - Passed to underlying <select>
 */
export default function TSelect({ id, label, error, className, children, ...rest }) {
  const errorId = `${id}-error`;

  const selectClasses = [
    styles.select,
    error ? styles.selectError : "",
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
      <select
        id={id}
        className={selectClasses}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
