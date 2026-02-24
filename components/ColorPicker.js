"use client";
import styles from "./ColorPicker.module.css";

const COLORS = [
  { name: "Red", hex: "#f80206" },
  { name: "Orange", hex: "#ff6600" },
  { name: "Blue", hex: "#4a9eff" },
  { name: "Green", hex: "#00cc66" },
  { name: "Purple", hex: "#9b59b6" },
  { name: "Yellow", hex: "#f1c40f" },
  { name: "Pink", hex: "#e91e8a" },
  { name: "White", hex: "#cccccc" },
  { name: "Crimson", hex: "#dc143c" },
  { name: "Coral", hex: "#ff7f50" },
  { name: "Navy", hex: "#1a5276" },
  { name: "Teal", hex: "#1abc9c" },
  { name: "Indigo", hex: "#6c5ce7" },
  { name: "Gold", hex: "#f39c12" },
  { name: "Magenta", hex: "#ff00ff" },
  { name: "Slate", hex: "#7f8c8d" },
];

export default function ColorPicker({ onSelectColor, onClose }) {
  const handleSelect = (hex) => {
    onSelectColor(hex);
    onClose();
  };

  return (
    <div className={styles.colorPicker} role="group" aria-label="Color picker" onClick={(e) => e.stopPropagation()}>
      <div className={styles.swatchGrid}>
        {COLORS.map((color) => (
          <button
            key={color.hex}
            className={styles.swatch}
            style={{ backgroundColor: color.hex }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(color.hex);
            }}
            aria-label={`Select ${color.name} color`}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
}
