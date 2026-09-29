/**
 * Tests for the docs endpoints and apiClient.fetchAuthorizedBlob:
 * every query parameter is encoded, the JWT only travels in the Authorization
 * header, and HTTP errors map to the apiClient error classes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchDocsTree,
  refreshDocsTree,
  fetchDocsFile,
  fetchDocsRawBlob,
  fetchDocsEmbedBlob,
} from "../docsService";
import {
  fetchAuthorizedBlob,
  setLogoutCallback,
  clearLogoutCallback,
  ApiError,
  AuthenticationError,
  AuthorizationError,
} from "../apiClient";
import { setToken, getToken, clearToken } from "../tokenStorage";

const TOKEN = "header.payload.signature";

/** Minimal fetch Response stand-in */
function mockResponse({
  status = 200,
  body = "",
  json = null,
  headers = {},
} = {}) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const blob = new Blob([body], { type: lower["content-type"] || "" });
  blob.text = async () => body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    blob: async () => blob,
    json: async () => {
      if (json === null) throw new SyntaxError("not json");
      return json;
    },
    text: async () => body,
  };
}

describe("docs service", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async () => mockResponse({ body: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    setToken(TOKEN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLogoutCallback();
    clearToken();
  });

  const lastUrl = () => fetchMock.mock.calls.at(-1)[0];
  const lastInit = () => fetchMock.mock.calls.at(-1)[1];

  it("encodes every embed parameter", async () => {
    await fetchDocsEmbedBlob(
      "LE Docs/Amira & Co/Amira #1.md",
      "#ClairLineArt.jpg?x=1",
      {
        literal: true,
      },
    );
    expect(lastUrl()).toBe(
      "/docs/embed?from=LE%20Docs%2FAmira%20%26%20Co%2FAmira%20%231.md" +
        "&target=%23ClairLineArt.jpg%3Fx%3D1&literal=true",
    );
    await fetchDocsEmbedBlob("a.md", "b.png");
    expect(lastUrl()).toBe("/docs/embed?from=a.md&target=b.png&literal=false");
  });

  it("encodes file and raw paths", async () => {
    await fetchDocsRawBlob("Insurance/Car Insurance/ID Card.pdf");
    expect(lastUrl()).toBe(
      "/docs/raw?path=Insurance%2FCar%20Insurance%2FID%20Card.pdf",
    );
    const text = await fetchDocsFile("LE Docs/Honor's Guard.md");
    expect(lastUrl()).toBe("/docs/file?path=LE%20Docs%2FHonor's%20Guard.md");
    expect(text).toBe("ok");
  });

  it("sends the JWT only in the Authorization header and forwards the signal", async () => {
    const controller = new AbortController();
    await fetchDocsRawBlob("a.png", { signal: controller.signal });
    expect(lastInit().headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(lastInit().signal).toBe(controller.signal);
    expect(lastInit().method).toBe("GET");
    expect(lastUrl()).not.toContain(TOKEN);
  });

  it("loads and refreshes the tree", async () => {
    fetchMock.mockImplementation(async () =>
      mockResponse({ json: { name: "", children: [] } }),
    );
    await fetchDocsTree();
    expect(lastUrl()).toBe("/docs/tree");
    await refreshDocsTree();
    expect(lastUrl()).toBe("/docs/refresh");
    expect(lastInit().method).toBe("POST");
  });

  it("maps 401 to logout + AuthenticationError", async () => {
    const logout = vi.fn();
    setLogoutCallback(logout);
    fetchMock.mockImplementation(async () => mockResponse({ status: 401 }));
    await expect(
      fetchAuthorizedBlob("/docs/raw?path=a.png"),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it("maps 403 to AuthorizationError and other errors to ApiError", async () => {
    fetchMock.mockImplementation(async () => mockResponse({ status: 403 }));
    await expect(fetchDocsRawBlob("a.png")).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    fetchMock.mockImplementation(async () =>
      mockResponse({ status: 404, json: { message: "Document not found" } }),
    );
    const err = await fetchDocsEmbedBlob("a.md", "b.png").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Document not found");

    fetchMock.mockImplementation(async () =>
      mockResponse({ status: 413, json: { message: "Too large" } }),
    );
    await expect(fetchDocsFile("big.md")).rejects.toMatchObject({
      status: 413,
      message: "Too large",
    });
  });
});
