"use client";
import styles from "./TButton.module.css";

/**
 * Button with four variants, each with a glow effect on hover.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {'primary'|'secondary'|'danger'|'ghost'} [props.variant='primary']
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.type='button'] - HTML button type
 * @param {function} [props.onClick]
 * @param {string} [props.className]
 * @param {string} [props.ariaLabel] - Accessible label
 */
export default function TButton({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  onClick,
  className,
  ariaLabel,
}) {
  const btnClasses = [
    styles.btn,
    styles[variant] || styles.primary,
    disabled ? styles.disabled : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={btnClasses}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
