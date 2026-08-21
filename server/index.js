import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import analyzeReportRouter from "./routes/analyze-report.js";
import investigationToolkitRouter from "./routes/investigation-toolkit.js";

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

// `index: true` (the default) lets this serve dist/index.html directly for
// "/" — the SPA-fallback wildcard below only matches paths with at least one
// segment, so root needs static's own index handling to cover it.
app.use(express.static(distDir));

// SPA fallback: any other GET (e.g. a hard refresh on /toolkit) serves the
// app shell so client-side routing can take over. Express 5 (path-to-regexp
// v8) requires wildcards to be named — bare "*" throws at startup.
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Investigation Assistant listening on port ${PORT}`);
});
