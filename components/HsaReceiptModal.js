"use client";

/**
 * HSA Receipt Upload Modal
 * Takes a receipt file, a whole-dollar amount, and a receipt date, renames the
 * file to `{amount}_{YYYY}_{MON}_{DD}.{ext}`, and uploads it into the
 * "HSA Receipts" folder of the Admin Drive for future reimbursement.
 *
 * Upload state is local rather than in HealthContext — nothing here is shared
 * across health screens, matching the self-contained PlexUploadModal pattern.
 */

import { useState, useEffect } from "react";
import HealthModal from "./HealthModal";
import TButton from "./TButton";
import TInput from "./TInput";
import { useAuth } from "@/src/context/AuthContext";
import * as hsaService from "@/src/lib/hsaService";
import * as driveService from "@/src/lib/driveService";
import {
  parseAmount,
  parseReceiptDate,
  buildReceiptFileName,
  todayIso,
} from "@/utils/hsaReceipt";
import styles from "./HsaReceiptModal.module.css";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} [props.onUploaded] - Called with the stored filename on success
 */
export default function HsaReceiptModal({ isOpen, onClose, onUploaded }) {
  const { username } = useAuth();

  const [file, setFile] = useState(null);
  const [amount, setAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIso);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savedName, setSavedName] = useState(null);
  // Bumping this remounts the file field, which is how it gets cleared —
  // TInput does not forward refs.
  const [fileFieldKey, setFileFieldKey] = useState(0);

  // Reset every field whenever the modal is reopened, so a stale error or
  // success line never greets the next use.
  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setAmount("");
    setReceiptDate(todayIso());
    setErrors({});
    setSubmitError(null);
    setUploading(false);
    setProgress(0);
    setSavedName(null);
    setFileFieldKey((k) => k + 1);
  }, [isOpen]);

  const parsedAmount = parseAmount(amount);
  const parsedDate = parseReceiptDate(receiptDate);
  const previewName =
    file && parsedAmount.valid && parsedDate.valid
      ? buildReceiptFileName(parsedAmount.value, file.name, parsedDate.value)
      : null;

  function clearFieldError(field) {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSavedName(null);
    setSubmitError(null);
  }

  function handleFileChange(e) {
    setFile(e.target.files?.[0] || null);
    clearFieldError("file");
  }

  function handleAmountChange(e) {
    setAmount(e.target.value);
    clearFieldError("amount");
  }

  function handleDateChange(e) {
    setReceiptDate(e.target.value);
    clearFieldError("date");
  }

  function validate() {
    const next = {};

    if (!file) next.file = "Select a receipt file";
    else if (file.size === 0) next.file = "That file is empty";
    else if (file.size > MAX_FILE_BYTES)
      next.file = "File must be 25 MB or smaller";

    if (!parsedAmount.valid) next.amount = parsedAmount.error;
    if (!parsedDate.valid) next.date = parsedDate.error;

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (uploading) return;
    if (!validate()) return;

    setUploading(true);
    setProgress(0);
    setSubmitError(null);

    try {
      const { fileName } = await hsaService.uploadReceipt(
        username,
        file,
        parsedAmount.value,
        { onProgress: setProgress, isoDate: parsedDate.value },
      );
      setSavedName(fileName);
      setFile(null);
      setAmount("");
      setFileFieldKey((k) => k + 1);
      if (onUploaded) onUploaded(fileName);
    } catch (err) {
      setSubmitError(
        hsaService.isPermissionDenied(err)
          ? "Only administrators can file HSA receipts."
          : driveService.getErrorMessage(err),
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <HealthModal isOpen={isOpen} onClose={onClose} title="Upload HSA Receipt">
      <form className={styles.modalForm} onSubmit={handleSubmit} noValidate>
        {submitError && (
          <div className={styles.errorBanner} role="alert">
            Upload failed: {submitError}
          </div>
        )}

        <TInput
          key={fileFieldKey}
          id="hsa-file"
          label="Receipt File"
          type="file"
          accept="application/pdf,image/*"
          onChange={handleFileChange}
          error={errors.file}
        />

        <TInput
          id="hsa-amount"
          label="Amount (USD)"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={handleAmountChange}
          error={errors.amount}
          placeholder="1000"
        />

        <TInput
          id="hsa-date"
          label="Receipt Date"
          type="date"
          value={receiptDate}
          onChange={handleDateChange}
          error={errors.date}
        />

        {previewName && (
          <p className={styles.preview}>
            SAVES AS: <span className={styles.previewName}>{previewName}</span>
          </p>
        )}

        {uploading && (
          <div
            className={styles.progressTrack}
            role="status"
            aria-live="polite"
          >
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
            <span className={styles.progressText}>
              UPLOADING... {progress}%
            </span>
          </div>
        )}

        {savedName && !uploading && (
          <p className={styles.success} role="status">
            ✓ SAVED AS {savedName}
          </p>
        )}

        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={onClose} disabled={uploading}>
            CLOSE
          </TButton>
          <TButton variant="primary" type="submit" disabled={uploading}>
            {uploading ? "UPLOADING..." : "⬆ UPLOAD"}
          </TButton>
        </div>
      </form>
    </HealthModal>
  );
}
