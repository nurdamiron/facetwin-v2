// Vercel serverless function: the hosted replacement for `server.py` (/api/edit).
// The Gemini key lives in the Vercel env var GEMINI_API_KEY and never reaches the browser.
//
// Guardrails (a public URL would otherwise let anyone spend your key):
//  - the prompt is built HERE from the preview id (previews.js); only the "Your idea" text is free-form, 200 chars, cleaned
//  - allow-listed image types, size cap, same-origin only
//  - best-effort rate limit per IP and a daily cap per server instance (in memory; for a hard limit use Upstash/Vercel KV)
//  - photos are never logged or stored
import { promptFor, previewById, cleanIdea } from "../previews.js";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const MAX_B64 = 8_000_000; // about 6 MB of image
const PER_IP_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 20);
const DAILY_CAP = Number(process.env.DAILY_CAP || 500);
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const hits = new Map(); // ip -> [timestamps]
let day = { key: "", n: 0 };

function limited(ip) {
  const now = Date.now(), k = new Date(now).toISOString().slice(0, 10);
  if (day.key !== k) day = { key: k, n: 0 };
  if (day.n >= DAILY_CAP) return "Daily limit reached. Please try again tomorrow.";
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_IP_PER_HOUR) return "Too many edits in the last hour. Please try again later.";
  recent.push(now); hits.set(ip, recent); day.n++;
  if (hits.size > 5000) hits.clear();
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: "Not allowed" }); } catch { return res.status(403).json({ error: "Not allowed" }); } }
  const key = (process.env.GEMINI_API_KEY || "").trim();
  const MOCK = process.env.AI_MOCK === "1" && !process.env.VERCEL; // local tests only: returns the photo unchanged
  if (!key && !MOCK) return res.status(503).json({ error: "The AI editor is not set up yet." });

  const { image, mime = "image/jpeg", id, text = "" } = req.body || {};
  if (typeof image !== "string" || image.length < 100 || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 2000))) return res.status(400).json({ error: "Bad photo" });
  if (!MIMES.has(mime)) return res.status(400).json({ error: "Unsupported photo type" });
  if (typeof id !== "string" || !previewById(id)) return res.status(400).json({ error: "Unknown edit" });
  if (id === "custom" && cleanIdea(text).length < 4) return res.status(400).json({ error: "Describe the change first" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const why = limited(ip);
  if (why) return res.status(429).json({ error: why });

  if (MOCK && !key) return res.status(200).json({ image, mime, mock: true });
  const body = {
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: promptFor(id, text) }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: `AI service error ${r.status}. Try again.` });
    for (const cand of data.candidates || []) {
      for (const part of (cand.content && cand.content.parts) || []) {
        const inline = part.inlineData || part.inline_data;
        if (inline && inline.data) return res.status(200).json({ image: inline.data, mime: inline.mimeType || inline.mime_type || "image/png" });
      }
    }
    const reason = (data.promptFeedback && data.promptFeedback.blockReason) || (data.candidates && data.candidates[0] && data.candidates[0].finishReason) || "no image returned";
    return res.status(502).json({ error: `The AI didn't return an image (${reason}). Try another photo.` });
  } catch {
    return res.status(502).json({ error: "The AI service is unreachable. Try again." });
  }
}
