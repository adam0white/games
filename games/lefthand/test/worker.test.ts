import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, test, vi } from "vitest";
import worker from "../worker/index";

describe("precompressed engine response", () => {
  afterEach(() => vi.unstubAllGlobals());
  test("maps wasm to gzip storage and preserves exactly one compression layer", async () => {
    const NativeResponse = Response;
    const responseOptions: (ResponseInit | undefined)[] = [];
    vi.stubGlobal(
      "Response",
      class extends NativeResponse {
        constructor(body?: BodyInit | null, init?: ResponseInit) {
          super(body, init);
          responseOptions.push(init);
        }
      },
    );
    const bytes = gzipSync(new Uint8Array([0, 97, 115, 109]));
    const fetch = vi.fn(async (_request: Request) => new Response(bytes));
    const response = await worker.fetch(
      new Request("https://example.test/engine/game-abcd.wasm"),
      { ASSETS: { fetch } },
    );
    expect(new URL(fetch.mock.calls[0]?.[0]?.url ?? "").pathname).toBe(
      "/engine/game-abcd.wasm.gz",
    );
    expect(responseOptions.at(-1)?.encodeBody).toBe("manual");
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(response.headers.get("Content-Type")).toBe("application/wasm");
    expect([
      ...gunzipSync(new Uint8Array(await response.arrayBuffer())),
    ]).toEqual([0, 97, 115, 109]);
  });
  test("preserves missing responses without labelling their bodies as wasm", async () => {
    const missing = new Response("missing", { status: 404 });
    const response = await worker.fetch(
      new Request("https://example.test/engine/game-abcd.wasm"),
      { ASSETS: { fetch: async () => missing } },
    );
    expect(response).toBe(missing);
    expect(response.headers.has("Content-Encoding")).toBe(false);
  });
  test("passes other assets through and rejects non-read wasm methods", async () => {
    const asset = new Response("script");
    const fetch = vi.fn(async () => asset);
    expect(
      await worker.fetch(
        new Request("https://example.test/engine/game-abcd.audio.worklet.js"),
        { ASSETS: { fetch } },
      ),
    ).toBe(asset);
    const response = await worker.fetch(
      new Request("https://example.test/engine/game-abcd.wasm", {
        method: "POST",
      }),
      { ASSETS: { fetch } },
    );
    expect(response.status).toBe(405);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
