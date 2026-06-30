"use client";

/**
 * Health Graphs Screen
 * Sidebar listing metrics + main chart area with Chart.js visualization.
 * Supports line, bar, dual-line, and multi-line metric types.
 * Modals for adding/editing metrics and data points, plus a per-point list
 * under the chart for editing and deleting individual points.
 *
 * Requirements: 4.1–4.10, 11.3
 */

import { useState, useEffect, useMemo } from "react";
import { useHealth } from "@/src/context/HealthContext";
import TButton from "@/components/TButton";
import TInput from "@/components/TInput";
import TSelect from "@/components/TSelect";
import TCard from "@/components/TCard";
import HealthModal from "@/components/HealthModal";
import HealthChartWrapper from "@/components/HealthChartWrapper";
import { calculateSleepHours } from "@/utils/sleepCalculator";
import { formatShortDate } from "@/utils/dateFormatter";
import styles from "./graphs.module.css";

const SLEEP_METRIC_ID = "__sleep_hours__";
const SLEEP_METRIC_COLOR = "#a855f7";

/**
 * Builds a synthetic, read-only "Sleep Hours" metric from journal entries
 * where both bedTime and wakeTime are present. Sorted ascending by date.
 */
function buildSleepMetric(journalEntries) {
  const points = (journalEntries || [])
    .map((e) => ({ date: e.date, hours: calculateSleepHours(e.bedTime, e.wakeTime) }))
    .filter((p) => p.hours != null && p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: SLEEP_METRIC_ID,
    name: "Sleep Hours",
    type: "line",
    unit: "hours",
    colors: [SLEEP_METRIC_COLOR],
    labels: points.map((p) => formatShortDate(p.date)),
    data: points.map((p) => Number(p.hours.toFixed(2))),
    derived: true,
  };
}

/**
 * Computes the average sleep across the most recent N entries with valid data.
 * Returns null when there are no entries to average.
 */
function averageRecentSleep(sleepMetric, count = 7) {
  const data = sleepMetric.data || [];
  if (data.length === 0) return null;
  const recent = data.slice(-count);
  const sum = recent.reduce((acc, v) => acc + v, 0);
  return { avg: sum / recent.length, sampleSize: recent.length };
}

/**
 * Maps a Metric type to a Chart.js primitive type.
 * line → line, bar → bar, dual-line → line, multi-line → line
 * @param {string} metricType
 * @returns {'line'|'bar'}
 */
function chartPrimitive(metricType) {
  return metricType === "bar" ? "bar" : "line";
}

/** True for metric types that carry a `datasets` array rather than a flat `data` array. */
function isMultiSeries(metric) {
  return !!metric && (metric.type === "dual-line" || metric.type === "multi-line");
}

/**
 * Builds a Chart.js data object from a Metric.
 * Single-series (line/bar): uses metric.data + metric.colors[0]
 * Multi-series (dual-line/multi-line): uses metric.datasets array, colored by metric.colors[i]
 * @param {object} metric
 * @returns {object} Chart.js data object
 */
const FALLBACK_COLOR = "#00e5ff";

function buildChartData(metric) {
  const colors = metric.colors || [];

  if (metric.type === "dual-line" || metric.type === "multi-line") {
    return {
      labels: metric.labels || [],
      datasets: (metric.datasets || []).map((ds, i) => {
        const color = colors[i] || FALLBACK_COLOR;
        return {
          label: ds.label,
          data: ds.data,
          borderColor: color,
          backgroundColor: color + "33",
        };
      }),
    };
  }

  // Single-series: line or bar
  const color = colors[0] || FALLBACK_COLOR;
  return {
    labels: metric.labels || [],
    datasets: [
      {
        label: metric.name,
        data: metric.data || [],
        borderColor: color,
        backgroundColor: color + "33",
      },
    ],
  };
}

const INITIAL_METRIC_FORM = {
  name: "",
  type: "line",
  unit: "",
  color: "#00e5ff",
};

const INITIAL_POINT_FORM = {
  label: "",
  value: "",
};

export default function GraphsPage() {
  const {
    metrics,
    metricsLoading,
    metricsError,
    fetchMetrics,
    createMetric,
    addDataPoint,
    updateMetric,
    deleteMetric,
    updateDataPoint,
    deleteDataPoint,
    journalEntries,
    fetchJournalEntries,
  } = useHealth();

  // Synthetic Sleep Hours metric derived from journal entries
  const sleepMetric = useMemo(() => buildSleepMetric(journalEntries), [journalEntries]);

  // Combined list: synthetic Sleep Hours first, then user metrics
  const displayedMetrics = useMemo(
    () => [sleepMetric, ...metrics],
    [sleepMetric, metrics],
  );

  // Selection state
  const [selectedMetricId, setSelectedMetricId] = useState(null);

  // Modal visibility
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showPointModal, setShowPointModal] = useState(false);

  // Metric form (shared by Add + Edit). editingMetric=false → create, true → update.
  const [metricForm, setMetricForm] = useState(INITIAL_METRIC_FORM);
  const [metricErrors, setMetricErrors] = useState({});
  const [savingMetric, setSavingMetric] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);

  // Data point form (shared by Add + Edit). editingPointIndex=null → add, number → edit.
  const [pointForm, setPointForm] = useState(INITIAL_POINT_FORM);
  const [pointErrors, setPointErrors] = useState({});
  const [savingPoint, setSavingPoint] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState(null);

  // Multi-series values state (keyed by dataset.label, e.g., { Systolic: "", Diastolic: "" })
  const [seriesValues, setSeriesValues] = useState({});

  // Delete confirmation targets
  const [deletePointTarget, setDeletePointTarget] = useState(null); // { index, label }
  const [deletingPoint, setDeletingPoint] = useState(false);
  const [deleteMetricTarget, setDeleteMetricTarget] = useState(null); // metric object
  const [deletingMetric, setDeletingMetric] = useState(false);

  // Fetch metrics + journal entries on mount (journal feeds the Sleep Hours metric)
  useEffect(() => {
    fetchMetrics();
    fetchJournalEntries();
  }, [fetchMetrics, fetchJournalEntries]);

  // Auto-select Sleep Hours when nothing is selected
  useEffect(() => {
    if (selectedMetricId === null && displayedMetrics.length > 0) {
      setSelectedMetricId(displayedMetrics[0].id);
    }
  }, [displayedMetrics, selectedMetricId]);

  // Selected metric object
  const selectedMetric = useMemo(() => {
    return displayedMetrics.find((m) => m.id === selectedMetricId) || null;
  }, [displayedMetrics, selectedMetricId]);

  const isSleepMetricSelected = selectedMetric?.id === SLEEP_METRIC_ID;
  const sleepAverage = useMemo(
    () => (isSleepMetricSelected ? averageRecentSleep(sleepMetric, 7) : null),
    [isSleepMetricSelected, sleepMetric],
  );

  // Chart data for selected metric
  const chartData = useMemo(() => {
    if (!selectedMetric) return null;
    return buildChartData(selectedMetric);
  }, [selectedMetric]);

  // Per-point view model for the editable list under the chart. Each entry maps to
  // the metric's parallel-array index, which the API uses to target the point.
  const points = useMemo(() => {
    if (!selectedMetric || selectedMetric.derived) return [];
    const labels = selectedMetric.labels || [];
    const multi = isMultiSeries(selectedMetric);
    return labels.map((label, index) => {
      const values = multi
        ? (selectedMetric.datasets || []).map((ds) => ({
            name: ds.label,
            value: ds.data ? ds.data[index] : undefined,
          }))
        : [{ name: selectedMetric.unit || "Value", value: (selectedMetric.data || [])[index] }];
      return { index, label, values };
    });
  }, [selectedMetric]);

  // Per-metric chart options: axis titles and an empty-data fallback so the
  // x-axis doesn't render as 0–1 before any points exist.
  const chartOptions = useMemo(() => {
    if (!selectedMetric) return undefined;
    const hasPoints = (selectedMetric.labels || []).length > 0;
    const titleStyle = {
      display: true,
      color: "rgba(0,229,255,0.7)",
      font: { family: "'Share Tech Mono'", size: 12 },
    };
    // Only inject a `ticks` override when we want to disable display on an
    // empty chart. Including `ticks: undefined` would wipe the TRON tick
    // styling via the wrapper's deepMerge, leaving labels invisible.
    const xScale = {
      type: "category",
      title: { ...titleStyle, text: "Date" },
    };
    if (!hasPoints) {
      xScale.ticks = { display: false };
    }
    return {
      scales: {
        x: xScale,
        y: {
          title: { ...titleStyle, text: selectedMetric.unit || "Value" },
          beginAtZero: !hasPoints,
        },
      },
    };
  }, [selectedMetric]);

  // --- Metric modal (add + edit) handlers ---

  function handleMetricFieldChange(field, value) {
    setMetricForm((prev) => ({ ...prev, [field]: value }));
    if (metricErrors[field]) {
      setMetricErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateMetricForm() {
    const errs = {};
    if (!metricForm.name.trim()) errs.name = "Name is required";
    if (!metricForm.unit.trim()) errs.unit = "Unit is required";
    if (!metricForm.color.trim()) errs.color = "Color is required";
    return errs;
  }

  function openAddMetric() {
    setEditingMetric(false);
    setMetricForm(INITIAL_METRIC_FORM);
    setMetricErrors({});
    setShowMetricModal(true);
  }

  function openEditMetric() {
    if (!selectedMetric) return;
    setEditingMetric(true);
    setMetricForm({
      name: selectedMetric.name || "",
      type: selectedMetric.type || "line",
      unit: selectedMetric.unit || "",
      color: (selectedMetric.colors && selectedMetric.colors[0]) || "#00e5ff",
    });
    setMetricErrors({});
    setShowMetricModal(true);
  }

  function closeMetricModal() {
    setShowMetricModal(false);
    setEditingMetric(false);
    setMetricForm(INITIAL_METRIC_FORM);
    setMetricErrors({});
  }

  async function handleMetricSubmit(e) {
    e.preventDefault();
    const errs = validateMetricForm();
    if (Object.keys(errs).length > 0) {
      setMetricErrors(errs);
      return;
    }

    setSavingMetric(true);
    try {
      if (editingMetric && selectedMetric) {
        // Preserve any extra series colors; only the primary color is editable here.
        const existingColors = selectedMetric.colors || [];
        const colors = existingColors.length > 1
          ? [metricForm.color.trim(), ...existingColors.slice(1)]
          : [metricForm.color.trim()];
        await updateMetric(selectedMetric.id, {
          name: metricForm.name.trim(),
          unit: metricForm.unit.trim(),
          colors,
        });
      } else {
        await createMetric({
          name: metricForm.name.trim(),
          type: metricForm.type,
          unit: metricForm.unit.trim(),
          colors: [metricForm.color.trim()],
        });
      }
      closeMetricModal();
    } catch {
      // Error is set in context
    } finally {
      setSavingMetric(false);
    }
  }

  // --- Data point modal (add + edit) handlers ---

  function handlePointFieldChange(field, value) {
    setPointForm((prev) => ({ ...prev, [field]: value }));
    if (pointErrors[field]) {
      setPointErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validatePointForm() {
    const errs = {};
    if (!pointForm.label.trim()) errs.label = "Label is required";

    if (isMultiSeries(selectedMetric)) {
      (selectedMetric.datasets || []).forEach((ds) => {
        const val = seriesValues[ds.label];
        if (val === undefined || val === null || String(val).trim() === "") {
          errs[ds.label] = `${ds.label} is required`;
        } else if (isNaN(Number(val))) {
          errs[ds.label] = `${ds.label} must be a valid number`;
        }
      });
    } else {
      if (pointForm.value === "" || isNaN(Number(pointForm.value))) {
        errs.value = "A valid number is required";
      }
    }

    return errs;
  }

  function openAddPoint() {
    if (!selectedMetric) return;
    setEditingPointIndex(null);
    setPointForm(INITIAL_POINT_FORM);
    setPointErrors({});
    if (isMultiSeries(selectedMetric)) {
      const initial = {};
      (selectedMetric.datasets || []).forEach((ds) => {
        initial[ds.label] = "";
      });
      setSeriesValues(initial);
    } else {
      setSeriesValues({});
    }
    setShowPointModal(true);
  }

  function openEditPoint(point) {
    if (!selectedMetric) return;
    setEditingPointIndex(point.index);
    setPointErrors({});
    if (isMultiSeries(selectedMetric)) {
      const initial = {};
      point.values.forEach((v) => {
        initial[v.name] = v.value != null ? String(v.value) : "";
      });
      setSeriesValues(initial);
      setPointForm({ label: point.label || "", value: "" });
    } else {
      setSeriesValues({});
      setPointForm({
        label: point.label || "",
        value: point.values[0]?.value != null ? String(point.values[0].value) : "",
      });
    }
    setShowPointModal(true);
  }

  function closePointModal() {
    setShowPointModal(false);
    setEditingPointIndex(null);
    setPointForm(INITIAL_POINT_FORM);
    setPointErrors({});
    setSeriesValues({});
  }

  async function handlePointSubmit(e) {
    e.preventDefault();
    if (!selectedMetric) return;

    const errs = validatePointForm();
    if (Object.keys(errs).length > 0) {
      setPointErrors(errs);
      return;
    }

    const payload = isMultiSeries(selectedMetric)
      ? {
          label: pointForm.label.trim(),
          values: selectedMetric.datasets.map((ds) => ({
            label: ds.label,
            value: Number(seriesValues[ds.label]),
          })),
        }
      : {
          label: pointForm.label.trim(),
          value: Number(pointForm.value),
        };

    setSavingPoint(true);
    try {
      if (editingPointIndex === null) {
        await addDataPoint(selectedMetric.id, payload);
      } else {
        await updateDataPoint(selectedMetric.id, editingPointIndex, payload);
      }
      closePointModal();
    } catch (err) {
      if (err.errorCode === "HEALTH_VALIDATION_FAILED") {
        setPointErrors((prev) => ({ ...prev, api: err.message }));
      }
      // For other errors, error is already set in context
    } finally {
      setSavingPoint(false);
    }
  }

  // --- Delete handlers ---

  async function confirmDeletePoint() {
    if (!selectedMetric || !deletePointTarget) return;
    setDeletingPoint(true);
    try {
      await deleteDataPoint(selectedMetric.id, deletePointTarget.index);
      setDeletePointTarget(null);
    } catch {
      // Error is set in context
    } finally {
      setDeletingPoint(false);
    }
  }

  async function confirmDeleteMetric() {
    if (!deleteMetricTarget) return;
    setDeletingMetric(true);
    try {
      await deleteMetric(deleteMetricTarget.id);
      setDeleteMetricTarget(null);
      // Fall back to auto-selecting the first metric (Sleep Hours).
      setSelectedMetricId(null);
    } catch {
      // Error is set in context
    } finally {
      setDeletingMetric(false);
    }
  }

  // --- Metric selection ---

  function handleSelectMetric(metricId) {
    setSelectedMetricId(metricId);
  }

  // --- Render ---

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar} aria-label="Metrics list">
        <h2 className={styles.sidebarTitle}>Metrics</h2>

        {metricsLoading && (
          <p className={styles.loading}>Loading...</p>
        )}

        {displayedMetrics.map((metric) => (
          <div
            key={metric.id}
            className={`${styles.metricItem}${
              selectedMetricId === metric.id ? ` ${styles.metricItemActive}` : ""
            }`}
            onClick={() => handleSelectMetric(metric.id)}
            role="button"
            tabIndex={0}
            aria-pressed={selectedMetricId === metric.id}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelectMetric(metric.id);
              }
            }}
          >
            {metric.name}
          </div>
        ))}

        <div className={styles.addMetricSlot}>
          <TButton
            variant="secondary"
            onClick={openAddMetric}
            ariaLabel="Add new metric"
          >
            + Add Metric
          </TButton>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {/* Error banner */}
        {metricsError && (
          <div className={styles.errorBanner} role="alert">
            {metricsError}
          </div>
        )}

        {/* Chart display when a metric is selected */}
        {selectedMetric && chartData && (
          <>
            <div className={styles.chartHeader}>
              <div>
                <h1
                  className={styles.chartTitle}
                  style={{ color: (selectedMetric.colors && selectedMetric.colors[0]) || FALLBACK_COLOR }}
                >
                  {selectedMetric.name}
                </h1>
                <span className={styles.chartMeta}>
                  {selectedMetric.unit} · {selectedMetric.type}
                  {selectedMetric.derived ? " · derived from journal" : ""}
                </span>
              </div>
              {!selectedMetric.derived && (
                <div className={styles.chartActions}>
                  <TButton
                    variant="primary"
                    onClick={openAddPoint}
                    ariaLabel="Add data point to selected metric"
                  >
                    + Add Data Point
                  </TButton>
                  <TButton
                    variant="secondary"
                    onClick={openEditMetric}
                    ariaLabel="Edit this metric's settings"
                  >
                    Edit
                  </TButton>
                  {!selectedMetric.seeded && (
                    <TButton
                      variant="danger"
                      onClick={() => setDeleteMetricTarget(selectedMetric)}
                      ariaLabel="Delete this metric"
                    >
                      Delete
                    </TButton>
                  )}
                </div>
              )}
            </div>

            {isSleepMetricSelected && (
              <div className={styles.sleepAverage} role="status">
                {sleepAverage
                  ? `7-Day Average: ${sleepAverage.avg.toFixed(1)} hrs${
                      sleepAverage.sampleSize < 7
                        ? ` (from ${sleepAverage.sampleSize} ${
                            sleepAverage.sampleSize === 1 ? "entry" : "entries"
                          })`
                        : ""
                    }`
                  : "7-Day Average: — (no journal entries with sleep times yet)"}
              </div>
            )}

            <div className={styles.chartArea}>
              <HealthChartWrapper
                type={chartPrimitive(selectedMetric.type)}
                data={chartData}
                options={chartOptions}
              />
            </div>

            {/* Editable per-point list (not shown for the read-only Sleep metric) */}
            {!selectedMetric.derived && (
              <div className={styles.pointsSection}>
                <h2 className={styles.pointsTitle}>Data Points</h2>
                {points.length === 0 ? (
                  <p className={styles.emptyState}>
                    No data points yet. Use “+ Add Data Point” to add one.
                  </p>
                ) : (
                  <div className={styles.pointsList}>
                    {points.map((point) => {
                      const valueText =
                        point.values.length === 1
                          ? `${point.values[0].value ?? "—"}${
                              selectedMetric.unit ? ` ${selectedMetric.unit}` : ""
                            }`
                          : point.values
                              .map((v) => `${v.name}: ${v.value ?? "—"}`)
                              .join(" · ");
                      return (
                        <TCard key={point.index}>
                          <div className={styles.pointRow}>
                            <div className={styles.pointInfo}>
                              <span className={styles.pointDate}>
                                {formatShortDate(point.label)}
                              </span>
                              <span className={styles.pointValues}>{valueText}</span>
                            </div>
                            <div className={styles.pointActions}>
                              <TButton
                                variant="ghost"
                                onClick={() => openEditPoint(point)}
                                ariaLabel={`Edit data point for ${formatShortDate(point.label)}`}
                              >
                                ✎
                              </TButton>
                              <TButton
                                variant="danger"
                                onClick={() =>
                                  setDeletePointTarget({ index: point.index, label: point.label })
                                }
                                ariaLabel={`Delete data point for ${formatShortDate(point.label)}`}
                              >
                                ✕
                              </TButton>
                            </div>
                          </div>
                        </TCard>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Add / Edit Metric Modal */}
      <HealthModal
        isOpen={showMetricModal}
        onClose={closeMetricModal}
        title={editingMetric ? "Edit Metric" : "Add Metric"}
      >
        <form className={styles.modalForm} onSubmit={handleMetricSubmit} noValidate>
          <TInput
            id="metric-name"
            label="Name"
            value={metricForm.name}
            onChange={(e) => handleMetricFieldChange("name", e.target.value)}
            error={metricErrors.name}
            placeholder="e.g., Body Weight"
          />

          {!editingMetric && (
            <TSelect
              id="metric-type"
              label="Type"
              value={metricForm.type}
              onChange={(e) => handleMetricFieldChange("type", e.target.value)}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
              <option value="dual-line">Dual Line</option>
            </TSelect>
          )}

          <TInput
            id="metric-unit"
            label="Unit"
            value={metricForm.unit}
            onChange={(e) => handleMetricFieldChange("unit", e.target.value)}
            error={metricErrors.unit}
            placeholder="e.g., lbs, mg/dL"
          />

          <TInput
            id="metric-color"
            type="color"
            label="Color"
            value={metricForm.color}
            onChange={(e) => handleMetricFieldChange("color", e.target.value)}
            error={metricErrors.color}
          />

          <div className={styles.modalActions}>
            <TButton variant="ghost" onClick={closeMetricModal}>
              CANCEL
            </TButton>
            <TButton type="submit" disabled={savingMetric}>
              {savingMetric ? "SAVING..." : editingMetric ? "SAVE" : "CREATE"}
            </TButton>
          </div>
        </form>
      </HealthModal>

      {/* Add / Edit Data Point Modal */}
      <HealthModal
        isOpen={showPointModal}
        onClose={closePointModal}
        title={editingPointIndex === null ? "Add Data Point" : "Edit Data Point"}
      >
        <form className={styles.modalForm} onSubmit={handlePointSubmit} noValidate>
          <TInput
            id="point-label"
            label="Label (date)"
            type="date"
            value={pointForm.label}
            onChange={(e) => handlePointFieldChange("label", e.target.value)}
            error={pointErrors.label}
          />

          {isMultiSeries(selectedMetric) ? (
            <div className={styles.seriesInputGroup}>
              {(selectedMetric.datasets || []).map((ds) => (
                <div key={ds.label} className={styles.seriesInputLabel}>
                  <TInput
                    id={`point-value-${ds.label}`}
                    label={ds.label}
                    type="number"
                    step="any"
                    value={seriesValues[ds.label] || ""}
                    onChange={(e) =>
                      setSeriesValues((prev) => ({
                        ...prev,
                        [ds.label]: e.target.value,
                      }))
                    }
                    error={pointErrors[ds.label]}
                    placeholder="0"
                    aria-label={`${ds.label} value`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <TInput
              id="point-value"
              label="Value"
              type="number"
              step="any"
              value={pointForm.value}
              onChange={(e) => handlePointFieldChange("value", e.target.value)}
              error={pointErrors.value}
              placeholder="0"
            />
          )}

          {pointErrors.api && (
            <p className={styles.apiError} role="alert">{pointErrors.api}</p>
          )}

          <div className={styles.modalActions}>
            <TButton variant="ghost" onClick={closePointModal}>
              CANCEL
            </TButton>
            <TButton type="submit" disabled={savingPoint}>
              {savingPoint ? "SAVING..." : editingPointIndex === null ? "ADD POINT" : "SAVE"}
            </TButton>
          </div>
        </form>
      </HealthModal>

      {/* Delete Data Point Confirmation */}
      <HealthModal
        isOpen={deletePointTarget !== null}
        onClose={() => setDeletePointTarget(null)}
        title="Delete Data Point"
      >
        <p>
          Delete the data point for{" "}
          <strong>
            {deletePointTarget ? formatShortDate(deletePointTarget.label) : ""}
          </strong>
          ? This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeletePointTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDeletePoint} disabled={deletingPoint}>
            {deletingPoint ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>

      {/* Delete Metric Confirmation */}
      <HealthModal
        isOpen={deleteMetricTarget !== null}
        onClose={() => setDeleteMetricTarget(null)}
        title="Delete Metric"
      >
        <p>
          Delete the metric{" "}
          <strong>{deleteMetricTarget ? deleteMetricTarget.name : ""}</strong> and all
          of its data points? This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeleteMetricTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDeleteMetric} disabled={deletingMetric}>
            {deletingMetric ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>
    </div>
  );
}
