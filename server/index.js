import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import analyzeReportRouter from "./routes/analyze-report.js";
import investigationToolkitRouter from "./routes/investigation-toolkit.js";
import investigationsRouter from "./routes/investigations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

const app = express();

// Render sits the app behind a reverse proxy; trust its X-Forwarded-* headers
// so req.protocol/req.secure reflect the real client connection.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.get("/health", (req, res) => res.status(200).send("OK"));

app.use("/api/analyze-report", analyzeReportRouter);
app.use("/api/investigation-toolkit", investigationToolkitRouter);
app.use("/api/investigations", investigationsRouter);

// Body-parser errors (oversized or malformed JSON) land here — same response
// shape the API routes already use for their own validation failures.
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON request body" });
  }
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Vite's build gives every JS/CSS file a content hash in its filename
// (index-K-qks3HO.css), so those are safe to cache aggressively forever — a
// new deploy produces new filenames, never reuses an old one with different
// content. index.html has no hash and is what references those filenames,
// so it must never be cached: a stale cached index.html is exactly what
// makes a real, successful deploy look like "nothing changed" on a phone
// that cached the previous version's HTML shell.
//
// `index: true` (the default) lets this serve dist/index.html directly for
// "/" — the SPA-fallback wildcard below only matches paths with at least one
// segment, so root needs static's own index handling to cover it.
app.use(express.static(distDir, {
  index: "index.html",
  setHeaders(res, filePath) {
    if (path.basename(filePath) === "index.html") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

// SPA fallback: any other GET (e.g. a hard refresh on /toolkit) serves the
// app shell so client-side routing can take over. Express 5 (path-to-regexp
// v8) requires wildcards to be named — bare "*" throws at startup.
app.get("/*splat", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(distDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Investigation Assistant listening on port ${PORT}`);
});
