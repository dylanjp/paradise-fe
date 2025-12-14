import styles from "./Tile.module.css";

export default function Tile({ tileData }) {
  const { title, type, content, imageSrc } = tileData;

  return (
    <div className={styles.tile}>
      <h2 className={styles.tileTitle}>{title}</h2>

      {/* Render different content based on "type" */}
      {type === "image" && (
        <img src={imageSrc} alt={title} className={styles.tileImage} />
      )}

      {type === "text" && <p className={styles.tileText}>{content}</p>}

      {type === "list" && (
        <ul className={styles.tileList}>
          {content.map((item, index) => (
            <li key={index} className={styles.tileListItem}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
