/**
 * Documentation Service
 * Handles fetching the documentation tree, doc text and binary files (PDFs, images,
 * embedded attachments) from the backend API.
 *
 * Protected files are always fetched with the Authorization header and turned into
 * Blobs; callers create object URLs from them. Tokens never go in URLs.
 */

import { get, post, fetchAuthorizedBlob } from "./apiClient";

/**
 * Fetches the documentation file tree (admin-only vault roots are filtered server-side).
 * @returns {Promise<DocsTreeNode>} The root tree node
 */
export async function fetchDocsTree() {
  return get("/docs/tree");
}

/**
 * Re-scans the documentation roots on the backend and returns the fresh tree.
 * @returns {Promise<DocsTreeNode>} The root tree node
 */
export async function refreshDocsTree() {
  return post("/docs/refresh");
}

/**
 * Fetches the text content of a markdown or canvas file.
 * @param {string} relativePath - Tree path (e.g. "guides/getting-started.md")
 * @param {{signal?: AbortSignal}} [options] - Optional abort signal
 * @returns {Promise<string>} File text (UTF-8)
 */
export async function fetchDocsFile(relativePath, { signal } = {}) {
  const blob = await fetchAuthorizedBlob(
    `/docs/file?path=${encodeURIComponent(relativePath)}`,
    { signal },
  );
  return blob.text();
}

/**
 * Fetches a binary file from the tree (PDF or image) as a Blob.
 * @param {string} relativePath - Tree path
 * @param {{signal?: AbortSignal}} [options] - Optional abort signal
 * @returns {Promise<Blob>} File contents
 */
export async function fetchDocsRawBlob(relativePath, { signal } = {}) {
  return fetchAuthorizedBlob(
    `/docs/raw?path=${encodeURIComponent(relativePath)}`,
    {
      signal,
    },
  );
}

/**
 * Fetches a file embedded by a doc (![[image.png]], canvas file nodes ...).
 * The backend resolves the target relative to the embedding doc's vault and only
 * serves attachments that doc actually references.
 * @param {string} from - Tree path of the doc containing the embed
 * @param {string} target - Embed target as written in the doc
 * @param {{literal?: boolean, signal?: AbortSignal}} [options]
 *   literal: true keeps "#", "|" and "^" as part of the file name (canvas file nodes)
 * @returns {Promise<Blob>} File contents
 */
export async function fetchDocsEmbedBlob(
  from,
  target,
  { literal = false, signal } = {},
) {
  const query =
    `from=${encodeURIComponent(from)}` +
    `&target=${encodeURIComponent(target)}` +
    `&literal=${encodeURIComponent(literal ? "true" : "false")}`;
  return fetchAuthorizedBlob(`/docs/embed?${query}`, { signal });
}
