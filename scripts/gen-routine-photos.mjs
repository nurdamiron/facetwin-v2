// Generates one photo per skincare routine step with OpenAI Images (gpt-image-2.6-sunburst; set OPENAI_IMAGE_MODEL to change) into assets/routine/<id>.jpg.
//   OPENAI_API_KEY=sk-... node scripts/gen-routine-photos.mjs [stepId ...]     (no ids = every step that has no file yet)
// The photos are AI-generated illustrations of the step, not customers: do not present them as users or results.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "routine");
const STYLE = "Photorealistic editorial beauty photography, soft natural light, shallow depth of field, natural skin texture with visible pores, unretouched and authentic, a calm clean pastel background, 3:2 landscape, the person and the hands fully inside the frame and not awkwardly cropped. No text, no logos, no watermark, no brand names or labels on any product.";
export const SHOTS = {
  cleanse_am: ["#FFD9C9", "A young woman with light-brown skin at a bright bathroom sink in the morning, eyes closed, massaging a little foaming gentle cleanser into her cheeks with her fingertips."],
  spf: ["#CFE8FF", "A woman in her late twenties by a sunny window, two short lines of white sunscreen on two fingers, applying it to her cheek; bright morning light."],
  moisturizer: ["#E5DBFF", "A fair-skinned young woman with her hair tied back, a pea-size dab of cream on her fingertip, about to smooth it on her slightly damp cheek."],
  gel_moisturizer: ["#E5DBFF", "A young Black woman with a fresh glowing complexion applying a light transparent gel moisturizer to her forehead and nose with her fingertips."],
  eye_care: ["#FFF1B8", "A woman in her thirties gently tapping eye cream under her eye with her ring finger, relaxed expression, soft window light."],
  cleanse_pm: ["#FFD9C9", "A woman with tan skin in the evening under a warm lamp, wiping her cheek with a cotton pad soaked in micellar water to remove makeup."],
  hydrate: ["#C9F2DE", "A young woman with olive skin pressing a few drops of clear hydrating serum into her damp cheeks with both palms, eyes closed, soft light."],
  exfoliate: ["#FFF1B8", "A woman in her thirties swiping a cotton pad with a gentle exfoliating toner across her cheek and forehead, carefully avoiding the eye area."],
  soothe: ["#C9F2DE", "A calm young woman with slightly rosy cheeks smoothing a soothing serum over her cheeks with her fingertips, peaceful expression, soft light."],
  brow_serum: ["#FFC9DE", "Close-up of a woman's eyebrow being brushed upward with a small clean brow spoolie after a drop of serum, natural full brow, visible eye and temple."],
  retinoid: ["#E5DBFF", "A woman in her thirties in the evening dotting a pea-size amount of cream from her fingertip onto her forehead, away from her eyes."],
  spot: ["#FFC9DE", "A young woman leaning toward a mirror dabbing a tiny amount of treatment with a clean cotton swab on one small spot on her chin."],
  moist_pm: ["#E5DBFF", "A woman with brown skin before bed under a soft warm lamp, smoothing a rich night cream over her cheeks with both hands, relaxed."],
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS).filter((id) => !fs.existsSync(path.join(OUT, id + ".jpg")));
fs.mkdirSync(OUT, { recursive: true });
for (const id of ids) {
  const [color, scene] = SHOTS[id]; if (!scene) { console.error("unknown step", id); continue; }
  const prompt = `${scene} Pastel background tone ${color}. ${STYLE}`;
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "proxy-injected") },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst", prompt, size: "1536x1024", quality: "medium", output_format: "jpeg", output_compression: 82, n: 1 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.[0]?.b64_json) { console.error(id, "FAILED", r.status, JSON.stringify(j).slice(0, 300)); continue; }
  fs.writeFileSync(path.join(OUT, id + ".jpg"), Buffer.from(j.data[0].b64_json, "base64"));
  console.log(id, "ok", fs.statSync(path.join(OUT, id + ".jpg")).size, "bytes");
}
