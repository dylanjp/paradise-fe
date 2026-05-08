"use client";

/**
 * Health Portal Home Screen
 * Displays a 2×2 grid of TCard tiles linking to the four sub-screens.
 *
 * Requirements: 1.2, 1.3, 11.2, 12.4
 */

import Link from "next/link";
import TCard from "@/components/TCard";
import { formatLongDate } from "@/utils/dateFormatter";
import styles from "./home.module.css";

function DiamondIcon({ color }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      className={styles.tileIconSvg}
    >
      <path
        d="M16 4 L28 16 L16 28 L4 16 Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

function SquareIcon({ color }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      className={styles.tileIconSvg}
    >
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        fill="none"
        stroke={color}
        strokeWidth="2"
      />
      <rect x="13" y="13" width="6" height="6" fill={color} />
    </svg>
  );
}

function CircleIcon({ color }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      className={styles.tileIconSvg}
    >
      <circle cx="16" cy="16" r="11" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

const TILES = [
  {
    name: "DAILY JOURNAL",
    href: "/health/journal/",
    accent: "#00e5ff",
    Icon: DiamondIcon,
    desc: "LOG HEALTH DATA",
  },
  {
    name: "HEALTH GRAPHS",
    href: "/health/graphs/",
    accent: "#e040fb",
    Icon: DiamondIcon,
    desc: "VISUALIZE TRENDS",
  },
  {
    name: "HEALTH DOCS",
    href: "/health/documents/",
    accent: "#ffaa00",
    Icon: SquareIcon,
    desc: "FILES & RECORDS",
  },
  {
    name: "APPOINTMENTS",
    href: "/health/appointments/",
    accent: "#00ff9d",
    Icon: CircleIcon,
    desc: "VISITS & ALERTS",
  },
];

export default function HealthHome() {
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.portalTitle}>HEALTH PORTAL</h1>
        <p className={styles.subtitle}>{formatLongDate(todayISO)}</p>
        <div className={styles.divider} aria-hidden="true" />
      </div>

      <div className={styles.grid}>
        {TILES.map((tile) => {
          const Icon = tile.Icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={styles.tileLink}
              aria-label={tile.name}
              style={{ "--tile-accent": tile.accent }}
            >
              <TCard accentColor={tile.accent}>
                <div className={styles.tile}>
                  <span className={styles.tileIcon}>
                    <Icon color={tile.accent} />
                  </span>
                  <span className={styles.tileName}>{tile.name}</span>
                  <span
                    className={styles.tileDesc}
                    style={{ color: tile.accent }}
                  >
                    {tile.desc}
                  </span>
                </div>
              </TCard>
            </Link>
          );
        })}
      </div>

      <p className={styles.selectHint} aria-hidden="true">[ SELECT MODULE ]</p>
    </div>
  );
}
