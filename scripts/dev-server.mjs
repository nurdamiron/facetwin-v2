// Local dev server (no Python, no Vercel login): static files + the /api/* functions.
//   node scripts/dev-server.mjs            -> http://localhost:8080
//   Mocks (never set these in production):
//     STRIPE_MOCK=1  fake Stripe checkout   AI_MOCK=1  /api/edit returns the photo with a light tint
// Real keys also work: GEMINI_API_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_* (see README).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".wasm": "application/wasm",
  ".onnx": "application/octet-stream", ".task": "application/octet-stream", ".tflite": "application/octet-stream",
};

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };
  return res;
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let p = decodeURIComponent(url.pathname);
  if (p.startsWith("/api/")) {
    const file = path.join(ROOT, p + ".js");
    if (!file.startsWith(path.join(ROOT, "api")) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
    try {
      req.body = await readBody(req);
      const mod = await import(pathToFileURL(file).href + "?t=" + fs.statSync(file).mtimeMs);
      return await mod.default(req, shim(res));
    } catch (e) { console.error(e); res.statusCode = 500; return res.end(JSON.stringify({ error: String(e.message || e) })); }
  }
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`FaceTwin dev server on http://localhost:${PORT}  (STRIPE_MOCK=${process.env.STRIPE_MOCK || 0} AI_MOCK=${process.env.AI_MOCK || 0})`));
