import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/**
 * Dev-friendly wide-open CORS for the LAN remote UI.
 * Phone Safari loads Vite `crossorigin` module scripts over http://LAN-IP.
 */
const OPEN_CORS: Record<string, string> = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Embedder-Policy": "unsafe-none",
};

function safeJoin(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath.split("?")[0] ?? "/");
  const cleaned = decoded.replace(/^\/+/, "");
  const candidate = normalize(join(root, cleaned || "index.html"));
  const rootResolved = resolve(root);
  const relativePath = relative(rootResolved, candidate);
  if (relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    return null;
  }
  return candidate;
}

function sendText(
  res: ServerResponse,
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    ...OPEN_CORS,
  });
  res.end(body);
}

/**
 * Serve only the remote UI static root. No IPC, filesystem APIs, or desktop routes.
 */
export function handleRemoteStaticRequest(
  req: IncomingMessage,
  res: ServerResponse,
  staticRoot: string | null,
): void {
  if (req.method === "OPTIONS") {
    res.writeHead(204, OPEN_CORS);
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (!staticRoot || !existsSync(staticRoot)) {
    sendText(
      res,
      503,
      "Remote UI not available — build @coosy/remote and restart CoOSy.",
    );
    return;
  }

  const urlPath = req.url ?? "/";
  if (urlPath === "/health" || urlPath.startsWith("/health?")) {
    sendText(res, 200, "ok");
    return;
  }

  let filePath = safeJoin(staticRoot, urlPath);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    const indexPath = join(staticRoot, "index.html");
    if (!existsSync(indexPath)) {
      sendText(res, 404, "Not Found");
      return;
    }
    filePath = indexPath;
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  const size = statSync(filePath).size;
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": size,
    ...OPEN_CORS,
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}
