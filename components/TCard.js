"use client";
import styles from "./TCard.module.css";

/**
 * Reusable card with corner-bracket decorations on all four corners.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.accentColor='#00e5ff'] - Override accent color (CSS value)
 * @param {string} [props.borderColor] - Left border color for appointment cards
 * @param {function} [props.onClick] - Click handler (makes card interactive)
 * @param {string} [props.as='div'] - HTML element to render ('div', 'article', etc.)
 */
export default function TCard({
  children,
  className,
  accentColor = "#00e5ff",
  borderColor,
  onClick,
  as: Tag = "div",
}) {
  const isInteractive = typeof onClick === "function";

  const cardClasses = [
    styles.card,
    isInteractive ? styles.interactive : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardStyle = {
    border: `1px solid ${accentColor}28`,
    ...(borderColor ? { borderLeft: `3px solid ${borderColor}` } : {}),
  };

  const bracketColor = `${accentColor}cc`;

  const interactiveProps = isInteractive
    ? {
        onClick,
        tabIndex: 0,
        role: "button",
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        },
      }
    : {};

  return (
    <Tag className={cardClasses} style={cardStyle} {...interactiveProps}>
      <div
        className={`${styles.bracket} ${styles.bracketTL}`}
        style={{ borderColor: bracketColor }}
        aria-hidden="true"
      />
      <div
        className={`${styles.bracket} ${styles.bracketTR}`}
        style={{ borderColor: bracketColor }}
        aria-hidden="true"
      />
      <div
        className={`${styles.bracket} ${styles.bracketBL}`}
        style={{ borderColor: bracketColor }}
        aria-hidden="true"
      />
      <div
        className={`${styles.bracket} ${styles.bracketBR}`}
        style={{ borderColor: bracketColor }}
        aria-hidden="true"
      />
      {children}
    </Tag>
  );
}
