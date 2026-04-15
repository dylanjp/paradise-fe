/**
 * Documentation Service
 * Handles fetching documentation tree and file content from the backend API.
 */

import { get } from "./apiClient";
import { getToken } from "./tokenStorage";
import { handleUnauthorized } from "./apiClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL || "";

/**
 * Fetches the full documentation file tree.
 * @returns {Promise<DocsTreeNode>} The root tree node
 */
export async function fetchDocsTree() {
  return get("/docs/tree");
}

/**
 * Fetches the raw markdown content of a documentation file.
 * Uses a custom fetch since apiClient.get() JSON-parses all responses.
 * @param {string} relativePath - Relative path from the docs root (e.g. "guides/getting-started.md")
 * @returns {Promise<string>} Raw markdown string
 */
export async function fetchDocsFile(relativePath) {
  const url = `${API_BASE_URL}/docs/file?path=${encodeURIComponent(relativePath)}`;

  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { method: "GET", headers });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }

  if (!response.ok) {
    let message = "Failed to fetch document";
    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // Response may not be JSON
    }
    throw new Error(message);
  }

  return response.text();
}
