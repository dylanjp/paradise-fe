/**
 * Tests for driveService.downloadFile's preview cap: with maxBytes set the body
 * is streamed and the transfer aborted with PreviewTooLargeError as soon as the
 * limit is crossed (or up front when Content-Length already exceeds it).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadFile, PreviewTooLargeError } from "../driveService";
import { AuthenticationError, ApiError } from "../apiClient";
import { setToken, clearToken } from "../tokenStorage";

/** Response stand-in whose body streams the given chunk sizes */
function streamingResponse(chunkSizes, headers = {}) {
  const reader = {
    index: 0,
    read: vi.fn(async function () {
      if (this.index >= chunkSizes.length)
        return { done: true, value: undefined };
      return { done: false, value: new Uint8Array(chunkSizes[this.index++]) };
    }),
    cancel: vi.fn(async () => {}),
  };
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    body: { getReader: () => reader },
    blob: vi.fn(
      async () =>
        new Blob([new Uint8Array(chunkSizes.reduce((a, b) => a + b, 0))]),
    ),
    reader,
  };
}

describe("downloadFile", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fetchSignal = () => fetchMock.mock.calls.at(-1)[1].signal;

  it("returns the whole blob when no cap is given", async () => {
    const response = streamingResponse([10, 10]);
    fetchMock.mockResolvedValue(response);
    const blob = await downloadFile("dylan", "pratt", "item1");
    expect(blob.size).toBe(20);
    expect(response.blob).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/users/dylan/drives/pratt/items/item1/download",
    );
  });

  it("streams under the cap into a typed blob", async () => {
    const response = streamingResponse([100, 200, 50], {
      "Content-Type": "image/png",
    });
    fetchMock.mockResolvedValue(response);
    const blob = await downloadFile("dylan", "pratt", "item1", {
      maxBytes: 350,
    });
    expect(blob.size).toBe(350);
    expect(blob.type).toBe("image/png");
    expect(response.blob).not.toHaveBeenCalled();
  });

  it("aborts mid-stream once the cap is exceeded", async () => {
    const response = streamingResponse([100, 200, 300, 400]);
    fetchMock.mockResolvedValue(response);
    const err = await downloadFile("dylan", "pratt", "item1", {
      maxBytes: 250,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(PreviewTooLargeError);
    expect(err.maxBytes).toBe(250);
    expect(err.bytes).toBe(300);
    expect(response.reader.cancel).toHaveBeenCalled();
    expect(response.reader.read).toHaveBeenCalledTimes(2);
    expect(fetchSignal().aborted).toBe(true);
  });

  it("accepts a body exactly at the cap", async () => {
    fetchMock.mockResolvedValue(
      streamingResponse([100, 150], { "Content-Length": "250" }),
    );
    const blob = await downloadFile("dylan", "pratt", "item1", {
      maxBytes: 250,
    });
    expect(blob.size).toBe(250);
  });

  it("checks the size after the fact when the body can't be streamed", async () => {
    const response = streamingResponse([600]);
    response.body = null;
    fetchMock.mockResolvedValue(response);
    await expect(
      downloadFile("dylan", "pratt", "item1", { maxBytes: 500 }),
    ).rejects.toBeInstanceOf(PreviewTooLargeError);

    const small = streamingResponse([400]);
    small.body = null;
    fetchMock.mockResolvedValue(small);
    const blob = await downloadFile("dylan", "pratt", "item1", {
      maxBytes: 500,
    });
    expect(blob.size).toBe(400);
  });

  it("sends the JWT only in the Authorization header", async () => {
    const token = "hdr.payload.sig";
    setToken(token);
    try {
      fetchMock.mockResolvedValue(streamingResponse([1]));
      await downloadFile("dylan", "pratt", "item1", { maxBytes: 10 });
      const [url, init] = fetchMock.mock.calls.at(-1);
      expect(url).not.toContain(token);
      expect(init.headers.Authorization).toBe(`Bearer ${token}`);
      expect(init.method).toBe("GET");
    } finally {
      clearToken();
    }
  });

  it("rejects up front when Content-Length is over the cap", async () => {
    const response = streamingResponse([10], { "Content-Length": "5000" });
    fetchMock.mockResolvedValue(response);
    await expect(
      downloadFile("dylan", "pratt", "item1", { maxBytes: 1000 }),
    ).rejects.toBeInstanceOf(PreviewTooLargeError);
    expect(response.reader.read).not.toHaveBeenCalled();
    expect(fetchSignal().aborted).toBe(true);
  });

  it("follows the caller's abort signal", async () => {
    fetchMock.mockResolvedValue(streamingResponse([1]));
    const controller = new AbortController();
    await downloadFile("dylan", "pratt", "item1", {
      signal: controller.signal,
    });
    const inner = fetchSignal();
    expect(inner.aborted).toBe(false);

    const pending = new AbortController();
    fetchMock.mockImplementation(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const promise = downloadFile("dylan", "pratt", "item2", {
      signal: pending.signal,
      maxBytes: 10,
    });
    pending.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps the existing error mapping", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: async () => ({}),
    });
    await expect(
      downloadFile("dylan", "pratt", "x", { maxBytes: 10 }),
    ).rejects.toBeInstanceOf(AuthenticationError);

    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({
        message: "Item not found",
        errorCode: "DRIVE_ITEM_NOT_FOUND",
      }),
    });
    const err = await downloadFile("dylan", "pratt", "x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Item not found");
  });
});
