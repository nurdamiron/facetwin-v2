// One photo per face exercise (shows the movement and where it works) with OpenAI Images -> assets/exercises/<id>.jpg (1200 px wide).
//   OPENAI_API_KEY=sk-... node scripts/gen-exercise-photos.mjs [id ...]      (no ids = every exercise that has no file yet)
// AI-generated illustrations of the movement, not customers.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "exercises");
const STYLE = "Photorealistic, soft natural daylight, calm clean pastel background, natural skin, authentic and unretouched, 3:2 landscape, face and hands fully in the frame and large, the person looking at the camera. No text, no logos, no watermark.";
export const SHOTS = {
  jaw: "A young woman with light-brown skin doing a jaw-opener face exercise: mouth opened wide and relaxed, fingertips of both hands resting lightly on her jawline just below the ears, focused calm expression, head level, front view.",
  fish: "A woman in her late twenties doing the fish face exercise: cheeks sucked in and lips pushed forward into a fish pout, fingertips lightly touching her hollowed cheeks, front view, soft pastel lilac background.",
  kiss: "A woman in her thirties doing the ceiling kiss exercise: head tilted back, chin lifted, lips pushed up in a kiss toward the ceiling, one hand lightly on her neck under the chin to feel the muscles, three-quarter front view, pastel peach background.",
  vowels: "A young woman with olive skin saying a big round 'O': lips rounded and pushed forward in a clear circle, relaxed shoulders, fingertips lightly on her cheeks, front view, pastel yellow background.",
  puff: "A young Black woman puffing her cheeks full of air with lips firmly closed, one finger on each puffed cheek, playful but focused, front view, pastel mint background.",
  smile: "A woman in her thirties holding a wide closed-lip smile with both corners lifted evenly, fingertips resting lightly on the smile lines by her cheeks, front view, pastel pink background.",
  brow: "A woman in her twenties with eyebrows raised as high as possible, forehead lightly lifted, fingertips resting on her forehead above the brows, eyes wide, front view, pastel blue background.",
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS).filter((id) => !fs.existsSync(path.join(OUT, id + ".jpg")));
fs.mkdirSync(OUT, { recursive: true });
async function one(id) {
  const scene = SHOTS[id]; if (!scene) return console.error("unknown", id);
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "proxy-injected") },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst", prompt: `${scene} ${STYLE}`, size: "1536x1024", quality: "medium", output_format: "jpeg", output_compression: 82, n: 1 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.[0]?.b64_json) return console.error(id, "FAILED", r.status, JSON.stringify(j).slice(0, 200));
  const f = path.join(OUT, id + ".jpg"); fs.writeFileSync(f, Buffer.from(j.data[0].b64_json, "base64"));
  try { execFileSync("convert", [f, "-resize", "1200x", "-quality", "80", f]); } catch { /* keep the original size */ }
  console.log(id, "ok", fs.statSync(f).size);
}
for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map((id) => one(id).catch((e) => console.error(id, "ERR", e.message))));
