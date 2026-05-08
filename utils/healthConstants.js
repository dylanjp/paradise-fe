/**
 * Shared constants for the Health Portal module.
 */

/**
 * Energy levels for daily journal entries (index 0–4).
 * Each entry: { label, emoji, color }
 */
export const ENERGY_LEVELS = [
  { label: "EXTREMELY LOW", emoji: "😴", color: "#64748b" },
  { label: "LOW",           emoji: "😔", color: "#60a5fa" },
  { label: "MEDIUM",        emoji: "😐", color: "#a3e635" },
  { label: "HIGH",          emoji: "😊", color: "#fb923c" },
  { label: "EXTREMELY HIGH",emoji: "⚡", color: "#f43f5e" },
];

/**
 * Mood values (1–5) for daily journal entries. Backed by the seeded "mood"
 * health metric — the journal upserts a data point on save.
 */
export const MOOD_LEVELS = [1, 2, 3, 4, 5];

/**
 * Document categories for health document management.
 * Each entry: { label, icon, color }
 */
export const DOC_CATEGORIES = [
  { label: "Lab Results",   icon: "🧪", color: "#00e5ff" },
  { label: "Blood Test",    icon: "🩸", color: "#ff4444" },
  { label: "Imaging",       icon: "🩻", color: "#e040fb" },
  { label: "Prescriptions", icon: "💊", color: "#00ff9d" },
  { label: "Vaccination",   icon: "💉", color: "#ffaa00" },
  { label: "Visit Notes",   icon: "📋", color: "#60a5fa" },
  { label: "Other",         icon: "📁", color: "#64748b" },
];

/**
 * Appointment specialties: 11 options
 */
export const SPECIALTIES = [
  "Primary Care",
  "Cardiology",
  "Endocrinology",
  "Dermatology",
  "Orthopedics",
  "Neurology",
  "Gastroenterology",
  "Urology",
  "Ophthalmology",
  "Psychiatry",
  "Other",
];
