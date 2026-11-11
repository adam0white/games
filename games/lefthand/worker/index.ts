export default {
  async fetch(request: Request, env: { ASSETS: Pick<Env["ASSETS"], "fetch"> }) {
    const url = new URL(request.url);
    if (!/^\/engine\/game-[a-f0-9]+\.wasm$/.test(url.pathname))
      return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    url.pathname += ".gz";
    // Request the opaque gzip file without transport compression or partial ranges.
    const headers = new Headers(request.headers);
    headers.set("Accept-Encoding", "identity");
    headers.delete("Range");
    headers.delete("If-Range");
    const asset = await env.ASSETS.fetch(
      new Request(url, { method: request.method, headers }),
    );
    if (asset.status !== 200) return asset;
    const responseHeaders = new Headers(asset.headers);
    responseHeaders.set("Content-Type", "application/wasm");
    responseHeaders.set("Content-Encoding", "gzip");
    responseHeaders.set(
      "Cache-Control",
      "public, max-age=31536000, immutable, no-transform",
    );
    responseHeaders.delete("Content-Length");
    // The bytes already contain one gzip layer. Workers must not encode them again.
    return new Response(request.method === "HEAD" ? null : asset.body, {
      status: asset.status,
      headers: responseHeaders,
      encodeBody: "manual",
    });
  },
} satisfies ExportedHandler<Env>;
