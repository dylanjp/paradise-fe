"use client";
import styles from "./TInput.module.css";

/**
 * Styled text input for the Health Portal.
 *
 * @param {object} props
 * @param {string} props.id - Input id (for label association)
 * @param {string} [props.label] - Label text
 * @param {string} [props.error] - Inline validation error message
 * @param {string} [props.className]
 * @param {...any} rest - Passed to underlying <input>
 */
export default function TInput({ id, label, error, className, ...rest }) {
  const errorId = `${id}-error`;

  const inputClasses = [
    styles.input,
    error ? styles.inputError : "",
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
      <input
        id={id}
        className={inputClasses}
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
