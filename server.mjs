import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 5173;
const VOICEVOX_BASE_URLS = ["http://127.0.0.1:50021", "http://localhost:50021"];
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/voicevox" || url.pathname.startsWith("/voicevox/")) {
      await proxyVoicevox(req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`INRITSUKI server: http://${HOST}:${PORT}/`);
  console.log(`VOICEVOX proxy:  http://${HOST}:${PORT}/voicevox/`);
});

async function serveStatic(requestPath, res) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.resolve(ROOT_DIR, `.${normalizedPath}`);

  if (!resolvedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(resolvedPath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  if (!fileStat.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  res.writeHead(200, {
    "Content-Length": fileStat.size,
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
  });
  createReadStream(resolvedPath).pipe(res);
}

async function proxyVoicevox(clientReq, clientRes, url) {
  const upstreamPath = `${url.pathname.replace(/^\/voicevox/, "") || "/"}${url.search}`;
  const bodyBuffer = await readRequestBody(clientReq);
  const errors = [];

  for (const baseUrl of VOICEVOX_BASE_URLS) {
    try {
      const upstreamResponse = await fetch(`${baseUrl}${upstreamPath}`, {
        method: clientReq.method,
        headers: filterHeaders(clientReq.headers),
        body: shouldSendBody(clientReq.method) ? bodyBuffer : undefined,
      });

      const headers = Object.fromEntries(upstreamResponse.headers.entries());
      clientRes.writeHead(upstreamResponse.status, headers);
      const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
      clientRes.end(responseBuffer);
      return;
    } catch (error) {
      errors.push(`${baseUrl}${upstreamPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  clientRes.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
  clientRes.end(`VOICEVOX proxy error\n${errors.join("\n")}`);
}

function filterHeaders(headers) {
  const nextHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "origin" || lower === "referer" || lower === "content-length") {
      continue;
    }
    if (typeof value !== "undefined") {
      nextHeaders[key] = value;
    }
  }

  return nextHeaders;
}

function shouldSendBody(method) {
  return method !== "GET" && method !== "HEAD";
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}
