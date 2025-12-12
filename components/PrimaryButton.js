"use client";
import styles from "./PrimaryButton.module.css";

export default function PrimaryButton({
  children,
  onClick,
  type = "button",
  className = "",
  disabled = false,
  ...props
}) {
  const classes = `${styles.primaryButton} ${className}`.trim();

  return (
    <button
      className={classes}
      onClick={onClick}
      type={type}
      disabled={disabled}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
