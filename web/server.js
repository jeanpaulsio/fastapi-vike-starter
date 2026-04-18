// Production SSR server — only used in prod (Render).
// Dev uses `vike dev` which has its own server with Vite HMR.
import express from "express";
import { renderPage } from "vike/server";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = express();

// ── Logging ────────────────────────────────────────────────────────────────

// Log slow requests (>5s) and all 5xx errors
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 5000 || res.statusCode >= 500) {
      console.error(
        JSON.stringify({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  });
  next();
});

// ── Health check ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── Static assets ──────────────────────────────────────────────────────────

// Serve JS, CSS, images. index: false so all HTML routes fall through to Vike.
app.use(express.static(join(__dirname, "dist/client"), { index: false }));

// ── Request timeout ────────────────────────────────────────────────────────

// Kill stalled renders after 30s so they don't hang forever
app.use((_req, res, next) => {
  res.setTimeout(30_000, () => {
    if (!res.headersSent) {
      console.error(
        JSON.stringify({
          error: "request_timeout",
          message: "SSR render timed out after 30s",
          timestamp: new Date().toISOString(),
        }),
      );
      res.status(504).end("Request timed out");
    }
  });
  next();
});

// ── Vike SSR handler ───────────────────────────────────────────────────────

app.get("*", async (req, res) => {
  try {
    const pageContext = await renderPage({
      urlOriginal: req.originalUrl,
      headers: req.headers,
    });

    const { httpResponse } = pageContext;

    if (!httpResponse) {
      res.status(404).end();
      return;
    }

    const { statusCode, headers, body } = httpResponse;
    headers.forEach(([name, value]) => res.setHeader(name, value));
    res.status(statusCode).end(body);
  } catch (err) {
    console.error(
      JSON.stringify({
        error: "ssr_render_error",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
      }),
    );

    if (!res.headersSent) {
      res.status(500).end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Something went wrong</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f172a;color:#94a3b8">
<div style="text-align:center">
<h1 style="font-size:1.25rem;font-weight:700;color:#e2e8f0">Something went wrong</h1>
<p style="font-size:0.875rem;margin-top:0.5rem">An unexpected error occurred. Try refreshing the page.</p>
<a href="/" style="display:inline-block;margin-top:1rem;padding:0.5rem 1.25rem;background:#6366f1;color:white;border-radius:0.5rem;text-decoration:none;font-size:0.75rem;font-weight:600">Go Home</a>
</div></body></html>`);
    }
  }
});

// ── Global error handler ───────────────────────────────────────────────────

// Safety net for any unhandled Express errors
app.use((err, _req, res, _next) => {
  console.error(
    JSON.stringify({
      error: "unhandled_express_error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    }),
  );
  if (!res.headersSent) {
    res.status(500).end("Internal Server Error");
  }
});

// ── Process lifecycle ──────────────────────────────────────────────────────

process.on("uncaughtException", (err) => {
  console.error(JSON.stringify({ error: "uncaught_exception", message: err.message, stack: err.stack, timestamp: new Date().toISOString() }));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(JSON.stringify({ error: "unhandled_rejection", message: String(reason), timestamp: new Date().toISOString() }));
});

process.on("SIGTERM", () => {
  console.log(JSON.stringify({ event: "sigterm", timestamp: new Date().toISOString() }));
  process.exit(0);
});

// ── Memory monitoring ──────────────────────────────────────────────────────

setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed > 400 * 1024 * 1024) {
    console.warn(
      JSON.stringify({
        warning: "high_memory",
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + "MB",
        rss: Math.round(mem.rss / 1024 / 1024) + "MB",
        timestamp: new Date().toISOString(),
      }),
    );
  }
}, 60_000).unref(); // unref so it doesn't prevent graceful shutdown

// ── Start server ───────────────────────────────────────────────────────────

const server = app.listen(port, () => {
  console.log(
    JSON.stringify({
      event: "server_start",
      app: "{{APP_DISPLAY_NAME}}",
      port,
      node: process.version,
      timestamp: new Date().toISOString(),
    }),
  );
});

// Fix for Cloudflare 502s: Node's default keepAliveTimeout (5s) is too short.
// Cloudflare drops idle connections after ~100-900s. If Node closes first,
// Cloudflare sends a request on a dead socket and returns 502.
// See: https://render.com/docs/troubleshooting-deploys
// See: https://github.com/nodejs/node/issues/59193
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 125 * 1000; // Must be > keepAliveTimeout (Node.js requirement)
