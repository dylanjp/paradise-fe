"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import BlogAnimator from "./BlogAnimator";
import ImageLightbox from "./ImageLightbox";
import { renderObsidianMarkdown } from "@/src/lib/obsidian";
import { sanitizeHtml } from "@/src/lib/sanitizeHtml";
import { hydrateDocsEmbeds, findHeadingForLink } from "@/src/lib/docsEmbeds";
import markdownStyles from "./MarkdownBody.module.css";
import styles from "./DocsMarkdownView.module.css";

/** Above this size the decode animation is skipped (it walks every text node) */
const MAX_ANIMATED_CHARS = 200_000;

/**
 * Scrolls the heading a link points at into view inside the given scroll
 * container only (never the page), leaving a little space above it. The heading
 * is looked up in the link's own fragment (the doc, or the embedded note it's in).
 */
function scrollToHeading(container, root, anchor, id) {
  if (!container) return;
  const heading = findHeadingForLink(root, anchor, id);
  if (!heading) return;
  const top =
    heading.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    16;
  if (typeof container.scrollTo === "function") {
    container.scrollTo({ top, behavior: "smooth" });
  } else {
    container.scrollTop = top;
  }
}

/** Whether an element is an image that should open in the lightbox */
function lightboxImage(el) {
  const img = el.closest("img");
  if (!img || !img.getAttribute("src") || img.closest("a")) return null;
  return img;
}

/**
 * DocsMarkdownView - Renders an Obsidian markdown doc with the decode animation.
 *
 * Pipeline: renderObsidianMarkdown -> sanitizeHtml -> BlogAnimator (keyed by path).
 * Embeds (images, PDFs, notes) are hydrated afterwards straight in the DOM from
 * the per-document resource cache, so htmlContent never changes and the
 * animation is not restarted.
 *
 * Clicks are delegated: [data-doc-link] navigates, #docs-h-* anchors scroll
 * inside the content container, embedded images open in a lightbox.
 *
 * @param {string} path - Tree path of the doc
 * @param {string} text - Markdown source
 * @param {object} index - buildDocsIndex() result
 * @param {object} cache - createDocsResourceCache() result for this doc
 * @param {function} onSelectFile - Navigate to another doc by tree path
 * @param {object} scrollRef - Ref to the scrolling content container
 */
export default function DocsMarkdownView({
  path,
  text,
  index,
  cache,
  onSelectFile,
  scrollRef,
}) {
  const bodyRef = useRef(null);
  const indexRef = useRef(index);
  const [lightbox, setLightbox] = useState(null);

  const htmlContent = useMemo(
    () =>
      sanitizeHtml(renderObsidianMarkdown(text, { currentPath: path, index })),
    [text, path, index],
  );

  const enableAnimation = (text?.length || 0) <= MAX_ANIMATED_CHARS;

  // Latest index for embedded notes, without re-hydrating when only it changes
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Hydrate embeds after BlogAnimator (a child) has captured its text nodes
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || !cache) return undefined;
    return hydrateDocsEmbeds(root, cache, {
      index: indexRef.current,
      scrollRoot: scrollRef?.current || null,
    });
  }, [htmlContent, cache, scrollRef]);

  const handleClick = useCallback(
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const docLink = target.closest("[data-doc-link]");
      if (docLink) {
        e.preventDefault();
        const docPath = docLink.getAttribute("data-doc-link");
        if (docPath && onSelectFile) onSelectFile(docPath);
        return;
      }

      const anchor = target.closest("a[href^='#']");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        if (href.startsWith("#docs-h-")) {
          e.preventDefault();
          scrollToHeading(scrollRef?.current, bodyRef.current, anchor, href.slice(1));
        } else if (href === "#") {
          e.preventDefault();
        }
        return;
      }

      const img = lightboxImage(target);
      if (img) {
        setLightbox({ url: img.getAttribute("src"), alt: img.getAttribute("alt") || "" });
      }
    },
    [onSelectFile, scrollRef],
  );

  // Keyboard access to embedded images (hydration makes them focusable)
  const handleKeyDown = useCallback((e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target;
    if (!(target instanceof Element) || target.localName !== "img") return;
    const img = lightboxImage(target);
    if (!img) return;
    e.preventDefault();
    setLightbox({ url: img.getAttribute("src"), alt: img.getAttribute("alt") || "" });
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  return (
    <>
      <div
        ref={bodyRef}
        className={`${markdownStyles.markdownBody} ${styles.embedExtras}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <BlogAnimator
          key={path}
          htmlContent={htmlContent}
          enableAnimation={enableAnimation}
        />
      </div>
      {lightbox && (
        <ImageLightbox
          url={lightbox.url}
          alt={lightbox.alt}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}
