"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaDownload,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaFile,
  FaFileAlt,
  FaFileAudio,
  FaFileImage,
  FaFilePdf,
  FaFileVideo,
  FaMarkdown,
  FaProjectDiagram,
  FaRedo,
  FaTimes,
} from "react-icons/fa";
import ImageViewer from "./ImageViewer";
import PdfViewer from "./PdfViewer";
import {
  allowsOpenInNewTab,
  blobToDisplayUrl,
  getFileKind,
  getPlaybackMimeCandidates,
  getPreviewLimit,
  openBlobInNewTab,
  saveBlobAs,
} from "@/src/lib/fileTypes";
import { getErrorMessage, PreviewTooLargeError } from "@/src/lib/driveService";
import { renderObsidianMarkdown } from "@/src/lib/obsidian";
import { sanitizeHtml } from "@/src/lib/sanitizeHtml";
import markdownStyles from "./MarkdownBody.module.css";
import styles from "./FilePreviewModal.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, audio[controls], video[controls], [tabindex]:not([tabindex="-1"])';

/** Text is shown up to this many bytes */
const TEXT_PREVIEW_BYTES = 1024 * 1024;

/**
 * Markdown is only rendered up to this many bytes; larger files are shown as
 * plain text. Rendering runs synchronously on the main thread, and some inputs
 * (e.g. dense backslash escapes) cost marked far more than their size suggests.
 */
const MARKDOWN_RENDER_BYTES = 256 * 1024;

/**
 * Drive files come from other users: raw HTML is escaped, [[wikilinks]] stay
 * plain text and remote images become links (no tracking pixels).
 */
const MARKDOWN_OPTIONS = Object.freeze({
  allowRawHtml: false,
  wiki: false,
  allowRemoteImages: false,
});

const EMPTY_PREVIEW = Object.freeze({ key: null });

const KIND_ICONS = {
  image: FaFileImage,
  pdf: FaFilePdf,
  markdown: FaMarkdown,
  canvas: FaProjectDiagram,
  text: FaFileAlt,
  audio: FaFileAudio,
  video: FaFileVideo,
};

/** Identifies one load of one item; a retry gets a new key */
function requestKeyFor(itemKey, attempt) {
  return `${String(itemKey)}\u0000${attempt}`;
}

/** Formats a byte count for notices ("50 MB") */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Math.round(mb * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** True for the size-cap error thrown by driveService.downloadFile */
function isPreviewTooLarge(err) {
  return err instanceof PreviewTooLargeError || err?.name === "PreviewTooLargeError";
}

/**
 * First MIME type this browser says it can play for an audio/video extension,
 * or null when none (then the file is offered as a download instead).
 * Only called while the modal is open, i.e. in the browser.
 */
function pickPlaybackMime(kind, ext) {
  if (typeof document === "undefined") return null;
  try {
    const probe = document.createElement(kind === "audio" ? "audio" : "video");
    if (typeof probe.canPlayType !== "function") return null;
    return (
      getPlaybackMimeCandidates(ext).find(
        (mime) => mime && probe.canPlayType(mime) !== "",
      ) || null
    );
  } catch {
    return null;
  }
}

/** Blob.text(), with a FileReader fallback for older browsers (iOS Safari < 14) */
function readBlobText(blob) {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(blob, "utf-8");
  });
}

/** Reads (up to) the first TEXT_PREVIEW_BYTES of a blob as UTF-8 text */
async function readTextPreview(blob, note = null) {
  const truncated = blob.size > TEXT_PREVIEW_BYTES;
  const text = await readBlobText(truncated ? blob.slice(0, TEXT_PREVIEW_BYTES) : blob);
  return { view: "text", text, truncated, note };
}

/**
 * Turns a fetched blob into renderable preview content.
 * Any URL created here is returned with its revoke() so the caller owns it.
 * @param {string} kind - Preview kind from getFileKind()
 * @param {string} ext - File extension
 * @param {Blob} blob - File contents
 * @param {string|null} playbackMime - Chosen MIME for audio/video
 */
async function buildPreviewContent(kind, ext, blob, playbackMime) {
  switch (kind) {
    case "image":
    case "pdf": {
      // SVG becomes a data: URL (opaque origin); everything else a retyped object URL
      const { url, revoke } = await blobToDisplayUrl(blob, ext);
      return { url, revoke };
    }
    case "audio":
    case "video": {
      // Typed with the MIME canPlayType() accepted (e.g. .mov as video/mp4) so
      // browsers that trust the blob type still try to play it. Never html/svg.
      const url = URL.createObjectURL(blob.slice(0, blob.size, playbackMime));
      let revoked = false;
      return {
        url,
        revoke: () => {
          if (revoked) return;
          revoked = true;
          URL.revokeObjectURL(url);
        },
      };
    }
    case "markdown": {
      if (blob.size > MARKDOWN_RENDER_BYTES) {
        return readTextPreview(blob, "Large markdown files are shown as plain text.");
      }
      const text = await readBlobText(blob);
      const html = sanitizeHtml(renderObsidianMarkdown(text, MARKDOWN_OPTIONS));
      // The sanitizer fails closed (""); show the source rather than a blank page
      if (!html && text.trim()) return { view: "text", text, truncated: false, note: null };
      return { view: "markdown", html };
    }
    default:
      // text and canvas (JSON) are shown as plain text
      return readTextPreview(blob);
  }
}

/**
 * FilePreviewModal - In-browser preview of a Drive file.
 *
 * Fetches the file once per open item (with an abort signal and a per-kind size
 * cap) and shows it by kind: images, PDFs, plain text/code (and canvas JSON),
 * rendered markdown, audio and video. Anything too large, unplayable or failing
 * to load gets a notice with a Download button instead.
 *
 * Content is treated as hostile (shared files come from other users): text is
 * rendered as text, markdown is escaped and sanitized, SVG is only shown via a
 * data: URL, and object URLs always carry a safe MIME type.
 *
 * @param {boolean} isOpen - Controls visibility
 * @param {string} itemKey - Identity of the file; a new key loads a new file
 * @param {string} name - File name (header, downloads, alt text)
 * @param {string} ext - File extension, lower-case without the dot
 * @param {string} sizeLabel - Human-readable size shown in the header
 * @param {function} loadBlob - ({signal, maxBytes}) => Promise<Blob>; the latest
 *   function is always used, so an inline arrow is fine
 * @param {function} onDownload - Full (uncapped) download when no preview blob is
 *   available (too large, unplayable, failed, still loading)
 * @param {function} onClose - Called on Escape, the close button or a backdrop click
 */
export default function FilePreviewModal({
  isOpen,
  itemKey,
  name,
  ext,
  sizeLabel,
  loadBlob,
  onDownload,
  onClose,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const overlayPressRef = useRef(false);
  const titleId = useId();

  // Latest callbacks, so effects and listeners never depend on their identity
  const latestRef = useRef({ loadBlob, onDownload, onClose });
  useEffect(() => {
    latestRef.current = { loadBlob, onDownload, onClose };
  });

  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const [mediaErrorKey, setMediaErrorKey] = useState(null);

  const kind = getFileKind(ext);
  const isMedia = kind === "audio" || kind === "video";
  const hasItem = itemKey !== null && itemKey !== undefined;
  const requestKey = isOpen && hasItem ? requestKeyFor(itemKey, attempt) : null;

  // Probed only while open (client side); an unplayable format is never fetched
  const playbackMime = useMemo(
    () => (isOpen && isMedia ? pickPlaybackMime(kind, ext) : null),
    [isOpen, isMedia, kind, ext],
  );
  const blockedReason = !kind
    ? "type"
    : isMedia && !playbackMime
      ? "playback"
      : null;

  // Fetch and prepare the preview. Keyed on the item (plus retries), never on
  // loadBlob's identity; ext and the derived kind/MIME are fixed per item.
  useEffect(() => {
    if (!isOpen || !hasItem || blockedReason) return undefined;

    const key = requestKeyFor(itemKey, attempt);
    const controller = new AbortController();
    const { signal } = controller;
    let revokeUrl = null;

    (async () => {
      try {
        const blob = await latestRef.current.loadBlob({
          signal,
          maxBytes: getPreviewLimit(kind),
        });
        if (signal.aborted) return;
        if (!(blob instanceof Blob)) throw new Error("The file could not be read.");

        const content = await buildPreviewContent(kind, ext, blob, playbackMime);
        // Closed or switched while preparing: release the URL we just made
        if (signal.aborted) {
          content.revoke?.();
          return;
        }
        revokeUrl = content.revoke || null;
        setPreview({ key, status: "ready", kind, blob, ...content });
      } catch (err) {
        if (signal.aborted) return;
        if (isPreviewTooLarge(err)) {
          setPreview({
            key,
            status: "tooLarge",
            maxBytes: err.maxBytes ?? getPreviewLimit(kind),
          });
        } else {
          setPreview({ key, status: "error", message: getErrorMessage(err) });
        }
      }
    })();

    return () => {
      controller.abort();
      if (revokeUrl) revokeUrl();
      // Drop the blob (up to 250 MB) as soon as it's no longer shown; a reopen of
      // the same item reuses this key, so forget its playback failure too
      setPreview((prev) => (prev.key === key ? EMPTY_PREVIEW : prev));
      setMediaErrorKey((prev) => (prev === key ? null : prev));
    };
  }, [isOpen, hasItem, itemKey, attempt, blockedReason, kind, ext, playbackMime]);

  // Lock page scroll, move focus into the dialog, and restore both on close
  useEffect(() => {
    if (!isOpen) return undefined;

    // Keep the original opener if focus is already inside (StrictMode re-run)
    const active = document.activeElement;
    if (!panelRef.current || !panelRef.current.contains(active)) {
      previousFocusRef.current = active;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      // Use requestAnimationFrame to ensure DOM has settled
      requestAnimationFrame(() => {
        // Focus is somewhere real (dialog re-opened, user moved on): leave it
        const current = document.activeElement;
        if (current && current !== document.body && current.isConnected) return;
        const el = previousFocusRef.current;
        previousFocusRef.current = null;
        if (el && el.isConnected && typeof el.focus === "function") {
          el.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen]);

  // Escape closes; Tab / Shift+Tab cycle inside the dialog
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      if (e.defaultPrevented) return;
      e.stopPropagation();
      latestRef.current.onClose?.();
      return;
    }

    if (e.key === "Tab" && panelRef.current) {
      const focusableElements = Array.from(
        panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);
      if (focusableElements.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];
      const activeEl = document.activeElement;

      if (!panelRef.current.contains(activeEl)) {
        // Focus is outside the dialog (e.g. still on the page behind): pull it back in
        e.preventDefault();
        (e.shiftKey ? lastEl : firstEl).focus();
      } else if (e.shiftKey) {
        // Shift+Tab: if focus is on first element (or the panel), wrap to last
        if (activeEl === firstEl || activeEl === panelRef.current) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (activeEl === lastEl) {
        // Tab: if focus is on last element, wrap to first
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen || typeof document === "undefined") return null;

  const current = requestKey !== null && preview.key === requestKey ? preview : null;
  const blob = current?.status === "ready" ? current.blob : null;
  const mediaFailed = !!current && mediaErrorKey === current.key;
  const canOpenInTab = !!blob && allowsOpenInNewTab(kind, ext) && !mediaFailed;
  const TitleIcon = KIND_ICONS[kind] || FaFile;

  const close = () => latestRef.current.onClose?.();

  /** Full download through the page (used when there's no preview blob) */
  const downloadFull = () => latestRef.current.onDownload?.();

  const handleDownload = () => {
    if (blob) saveBlobAs(blob, name);
    else downloadFull();
  };

  const handleOpenInTab = () => {
    // Audio/video open with the MIME that plays here (e.g. .mov as video/mp4)
    if (blob) openBlobInNewTab(blob, ext, isMedia ? { type: playbackMime } : undefined);
  };

  // Only a press that both starts and ends on the backdrop closes (not a text
  // selection dragged out of the panel)
  const handleOverlayMouseDown = (e) => {
    overlayPressRef.current = e.target === e.currentTarget;
  };
  const handleOverlayClick = (e) => {
    const pressedOnOverlay = overlayPressRef.current;
    overlayPressRef.current = false;
    if (pressedOnOverlay && e.target === e.currentTarget) close();
  };

  // Heading anchors scroll inside the preview; "#" links never touch the page URL
  const handleMarkdownClick = (e) => {
    const link = e.target instanceof Element ? e.target.closest("a") : null;
    if (!link || !e.currentTarget.contains(link)) return;
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const id = href.slice(1);
    const heading = Array.from(
      e.currentTarget.querySelectorAll('[id^="docs-h-"]'),
    ).find((el) => el.id === id);
    heading?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const renderNotice = ({ icon: Icon = FaExclamationTriangle, title, text, actions }) => (
    <div className={styles.notice} role="status">
      <Icon className={styles.noticeIcon} aria-hidden="true" />
      <p className={styles.noticeTitle}>{title}</p>
      {text && <p className={styles.noticeText}>{text}</p>}
      <div className={styles.noticeActions}>{actions}</div>
    </div>
  );

  const downloadButton = (onClick, label = "Download") => (
    <button type="button" className={styles.actionButton} onClick={onClick}>
      <FaDownload aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  const renderTextView = (content) => (
    <>
      {(content.truncated || content.note) && (
        <div className={styles.truncatedNotice} role="note">
          <span>
            {content.note ? `${content.note} ` : ""}
            {content.truncated
              ? `Showing the first ${formatBytes(TEXT_PREVIEW_BYTES)}${
                  sizeLabel ? ` of ${sizeLabel}` : ""
                }.`
              : ""}
          </span>
          {content.truncated && downloadButton(handleDownload, "Download full file")}
        </div>
      )}
      <pre className={styles.textView} tabIndex={0} aria-label={`Contents of ${name}`}>
        {content.text || "This file is empty."}
      </pre>
    </>
  );

  const renderReady = () => {
    if (mediaFailed) {
      return renderNotice({
        icon: kind === "audio" ? FaFileAudio : FaFileVideo,
        title: "Can't play this file",
        text: "Your browser couldn't play this file. Download it to open it in another app.",
        actions: downloadButton(handleDownload),
      });
    }

    switch (current.kind) {
      case "image":
        return <ImageViewer url={current.url} alt={name} />;
      case "pdf":
        return (
          <PdfViewer blob={current.blob} url={current.url} fileName={name} toolbar={false} />
        );
      case "audio":
        return (
          <div className={styles.mediaStage}>
            <audio
              className={styles.audio}
              src={current.url}
              controls
              preload="metadata"
              aria-label={name}
              onError={() => setMediaErrorKey(current.key)}
            />
          </div>
        );
      case "video":
        return (
          <div className={styles.mediaStage}>
            <video
              className={styles.video}
              src={current.url}
              controls
              playsInline
              preload="metadata"
              aria-label={name}
              onError={() => setMediaErrorKey(current.key)}
            />
          </div>
        );
      default:
        if (current.view === "markdown") {
          if (!current.html) return renderTextView({ text: "" });
          return (
            <div
              className={`${markdownStyles.markdownBody} ${styles.markdownView}`}
              tabIndex={0}
              aria-label={`Rendered ${name}`}
              onClick={handleMarkdownClick}
              // Sanitized with the strict allowlist in sanitizeHtml()
              dangerouslySetInnerHTML={{ __html: current.html }}
            />
          );
        }
        return renderTextView(current);
    }
  };

  const renderBody = () => {
    if (blockedReason === "type") {
      return renderNotice({
        icon: FaFile,
        title: "No preview available",
        text: "This file type can't be previewed in the browser.",
        actions: downloadButton(downloadFull),
      });
    }
    if (blockedReason === "playback") {
      return renderNotice({
        icon: kind === "audio" ? FaFileAudio : FaFileVideo,
        title: "Can't play this format",
        text: "Your browser can't play this file. Download it to open it in another app.",
        actions: downloadButton(downloadFull),
      });
    }
    if (!current) {
      return (
        <div className={styles.loading} role="status">
          <p className={styles.loadingText}>LOADING PREVIEW</p>
          <div className={styles.loadingBar} aria-hidden="true" />
        </div>
      );
    }
    if (current.status === "tooLarge") {
      const limit = formatBytes(current.maxBytes);
      return renderNotice({
        title: "Too large to preview",
        text: `Files over ${limit || "the preview limit"} can't be previewed. Download it instead.`,
        actions: downloadButton(downloadFull),
      });
    }
    if (current.status === "error") {
      return renderNotice({
        title: "Preview failed",
        text: current.message,
        actions: (
          <>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setAttempt((n) => n + 1)}
            >
              <FaRedo aria-hidden="true" />
              <span>Retry</span>
            </button>
            {downloadButton(downloadFull)}
          </>
        ),
      });
    }
    return renderReady();
  };

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <TitleIcon className={styles.titleIcon} aria-hidden="true" />
            <div className={styles.titleText}>
              <h2 id={titleId} className={styles.title} title={name}>
                {name}
              </h2>
              {sizeLabel && <span className={styles.size}>{sizeLabel}</span>}
            </div>
          </div>
          <div className={styles.actions}>
            {canOpenInTab && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleOpenInTab}
                aria-label="Open in new tab"
                title="Open in new tab"
              >
                <FaExternalLinkAlt aria-hidden="true" />
                <span className={styles.buttonLabel}>Open in new tab</span>
              </button>
            )}
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleDownload}
              aria-label={`Download ${name}`}
              title="Download"
            >
              <FaDownload aria-hidden="true" />
              <span className={styles.buttonLabel}>Download</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={close}
              aria-label="Close preview"
              title="Close"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className={styles.body} aria-busy={!blockedReason && !current}>
          {renderBody()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
