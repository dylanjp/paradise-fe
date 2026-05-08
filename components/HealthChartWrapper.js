"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import styles from "./HealthChartWrapper.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const TRON_CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: {
      labels: {
        color: "rgba(0,229,255,0.7)",
        font: { family: "'Share Tech Mono'", size: 11 },
        boxWidth: 12,
      },
    },
    tooltip: {
      backgroundColor: "rgba(0,10,28,0.95)",
      borderColor: "rgba(0,229,255,0.3)",
      borderWidth: 1,
      titleColor: "#00e5ff",
      bodyColor: "rgba(0,229,255,0.7)",
      titleFont: { family: "'Orbitron'", size: 11 },
      bodyFont: { family: "'Share Tech Mono'", size: 11 },
    },
  },
  scales: {
    x: {
      ticks: {
        color: "rgba(0,229,255,0.5)",
        font: { family: "'Share Tech Mono'", size: 11 },
      },
      grid: { color: "rgba(0,229,255,0.06)" },
      border: { color: "rgba(0,229,255,0.15)" },
    },
    y: {
      ticks: {
        color: "rgba(0,229,255,0.5)",
        font: { family: "'Share Tech Mono'", size: 11 },
      },
      grid: { color: "rgba(0,229,255,0.06)" },
      border: { color: "rgba(0,229,255,0.15)" },
    },
  },
};

/**
 * Deep merges two objects. Arrays are replaced, not merged.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Chart.js wrapper with TRON dark theme defaults.
 * Renders a Line or Bar chart from react-chartjs-2.
 *
 * @param {object} props
 * @param {'line'|'bar'} props.type - Chart.js primitive chart type
 * @param {object} props.data - Chart.js data object (labels, datasets)
 * @param {object} [props.options] - Chart.js options override (deep-merged with TRON defaults)
 * @param {string} [props.className] - Additional CSS class for the wrapper
 */
export default function HealthChartWrapper({ type, data, options, className }) {
  const mergedOptions = useMemo(
    () => (options ? deepMerge(TRON_CHART_DEFAULTS, options) : TRON_CHART_DEFAULTS),
    [options],
  );

  const ChartComponent = type === "bar" ? Bar : Line;

  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ""}`}>
      <ChartComponent data={data} options={mergedOptions} />
    </div>
  );
}
