// Production SSR server — only used in prod (Render).
// Dev uses `vike dev` which has its own server with Vite HMR.
import express from "express";
import { renderPage } from "vike/server";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Serve static assets (JS, CSS, images). index: false so all HTML
// routes fall through to the Vike handler below.
app.use(express.static(join(__dirname, "dist/client"), { index: false }));

// All routes handled by Vike SSR
app.get("*", async (req, res) => {
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
});

const port = parseInt(process.env.PORT ?? "3000", 10);
app.listen(port, () => {
  console.log(`{{APP_DISPLAY_NAME}} frontend running at http://localhost:${port}`);
});
