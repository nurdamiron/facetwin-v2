// Vercel serverless function: the hosted replacement for `server.py` (/api/edit).
// The AI key (GEMINI_API_KEY or OPENAI_API_KEY, see _ai.js) lives in Vercel env vars and never reaches the browser.
//
// Guardrails (a public URL would otherwise let anyone spend your key):
//  - the prompt is built HERE from the preview id (previews.js); only the "Your idea" text is free-form, 200 chars, cleaned
//  - allow-listed image types, size cap, same-origin only
//  - best-effort rate limit per IP and a daily cap per server instance (in memory; for a hard limit use Upstash/Vercel KV)
//  - photos are never logged or stored
import { promptFor, previewById, cleanIdea } from "../previews.js";
import { aiProvider } from "./_ai.js";

const MAX_B64 = 8_000_000; // about 6 MB of image
const PER_IP_PER_HOUR = Number(process.env.AI_EDITS_PER_HOUR || process.env.RATE_LIMIT_PER_HOUR || 20); // AI_EDITS_PER_HOUR is the documented name
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
  const ai = aiProvider(), key = ai ? ai.key : "";
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
  if (ai.name === "openai") return editOpenAI(res, ai, image, mime, promptFor(id, text));
  const MODEL = ai.model;
  const body = {
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: promptFor(id, text) }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = (data && data.error) || {}; console.error("[ai] gemini", r.status, e.status || e.code || "", String(e.message || "").slice(0, 200)); // reason goes to the Vercel log only
      const hint = r.status === 400 && /API key/i.test(e.message || "") ? "The AI key is not valid." : r.status === 403 ? "The AI key isn't allowed to use this model." : r.status === 429 ? "The AI is busy or out of quota. Try again in a minute." : "";
      return res.status(502).json({ error: hint ? `${hint} (AI error ${r.status})` : `AI service error ${r.status}. Try again.` });
    }
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

// OpenAI Images "edits": multipart, the photo as a file, the prompt built on the server. JPEG out keeps the reply well under Vercel's 4.5 MB limit.
// input_fidelity=high asks the model to keep the face as it is; if the chosen model rejects an optional parameter (HTTP 400) we retry once without it.
async function editOpenAI(res, ai, image, mime, prompt) {
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium", fidelity = process.env.OPENAI_INPUT_FIDELITY === undefined ? (/^gpt-image-1/.test(ai.model) ? "high" : "") : process.env.OPENAI_INPUT_FIDELITY; // gpt-image-2 keeps the face by itself and rejects input_fidelity (HTTP 400), so it is only sent for the gpt-image-1 family
  const send = (optional, withSize = true) => { // optional: quality / format / fidelity; withSize: the size field (the last retry drops it too, so only model + prompt + image are sent)
    const fd = new FormData();
    fd.append("model", ai.model); fd.append("prompt", prompt); if (withSize) fd.append("size", "auto");
    fd.append("image", new Blob([Buffer.from(image, "base64")], { type: mime }), "photo." + (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"));
    if (optional) { fd.append("quality", quality); fd.append("output_format", "jpeg"); fd.append("output_compression", "90"); if (fidelity) fd.append("input_fidelity", fidelity); }
    return fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + ai.key }, body: fd, signal: AbortSignal.timeout(55_000) }); // stop before Vercel's 60 s limit so the user gets a clear message, not a blank 504
  };
  try {
    let r = await send(true);
    if (r.status === 400) r = await send(false);
    if (r.status === 400) r = await send(false, false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = (data && data.error) || {}; console.error("[ai] openai", r.status, e.code || e.type || "", String(e.message || "").slice(0, 200)); // reason goes to the Vercel log only (never the photo)
      const hint = r.status === 401 ? "The AI key is not valid." : r.status === 403 ? "The AI account isn't allowed to edit images yet (organization not verified?)." : r.status === 429 ? "The AI is busy or out of credit. Try again in a minute." : "";
      const detail = process.env.AI_DEBUG === "1" ? ` [${e.code || e.type || ""}: ${String(e.message || "").slice(0, 160)}]` : ""; // AI_DEBUG=1 in Vercel shows the reason in the app while we debug; remove it afterwards
      return res.status(502).json({ error: (hint ? `${hint} (AI error ${r.status})` : `AI service error ${r.status}. Try again.`) + detail });
    }
    const out = data.data && data.data[0] && data.data[0].b64_json;
    if (!out) return res.status(502).json({ error: "The AI didn't return an image. Try another photo." });
    return res.status(200).json({ image: out, mime: data.output_format === "png" ? "image/png" : data.output_format === "webp" ? "image/webp" : "image/jpeg" });
  } catch (e) {
    if (e && (e.name === "TimeoutError" || e.name === "AbortError")) return res.status(504).json({ error: "The AI took too long. Try again." });
    return res.status(502).json({ error: "The AI service is unreachable. Try again." });
  }
}
