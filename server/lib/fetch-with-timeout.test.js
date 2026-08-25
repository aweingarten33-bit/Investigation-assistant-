// @vitest-environment node
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { HttpError } from "./errors.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

// A server that accepts the connection but never responds — this is exactly
// the "stalled upstream" scenario the timeout exists to catch. Without a
// timeout, this request would hang forever.
function startHangingServer() {
  return new Promise((resolve) => {
    const server = createServer(() => {
      // never call res.end() — the request just hangs
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

describe("fetchWithTimeout", () => {
  it("aborts a stalled request instead of hanging forever, with a clean error", async () => {
    const server = await startHangingServer();
    const { port } = server.address();
    try {
      await expect(
        fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 50),
      ).rejects.toMatchObject({
        name: expect.stringMatching(/HttpError|Error/),
        status: 504,
      });
    } finally {
      server.close();
    }
  });

  it("throws an HttpError instance carrying a 504 status", async () => {
    const server = await startHangingServer();
    const { port } = server.address();
    try {
      let caught;
      try {
        await fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 50);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(HttpError);
      expect(caught.status).toBe(504);
      expect(caught.message).toMatch(/did not respond/i);
    } finally {
      server.close();
    }
  });

  it("resolves normally for a fast response, well under the timeout", async () => {
    const server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const response = await fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 5_000);
      expect(response.ok).toBe(true);
      expect(await response.text()).toBe("ok");
    } finally {
      server.close();
    }
  });
});
