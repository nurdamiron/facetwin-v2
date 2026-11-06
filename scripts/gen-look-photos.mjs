// One example photo per Looks option (hair color, hairstyle, braids, brows, beard) with OpenAI Images -> assets/looks/<id>.jpg (512 px).
//   OPENAI_API_KEY=sk-... node scripts/gen-look-photos.mjs [id ...]      (no ids = every option that has no file yet)
// These are AI-generated examples of a style, not customers and not a promise of a result.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "looks");
const STYLE = "Photorealistic portrait photo, soft studio light, plain pastel background, natural skin texture, authentic, no text, no logos, no watermark. Square framing, the described feature clearly visible and centered.";
const W = "a woman in her twenties", M = "a man in his late twenties";
export const LOOKS = {
  copper: `Head and shoulders of ${W} with shoulder-length natural copper red hair with realistic shine, front facing.`,
  honey: `Head and shoulders of ${W} with soft honey-blonde balayage hair, darker roots blending to golden ends, front facing.`,
  espresso: `Head and shoulders of ${W} with rich glossy espresso brown hair, front facing.`,
  platinum: `Head and shoulders of ${W} with cool platinum blonde hair, front facing.`,
  jet: `Head and shoulders of ${W} with glossy jet black hair, front facing.`,
  bangs: `Head and shoulders of ${W} with long hair and soft curtain bangs parted in the middle, front facing.`,
  bob: `Head and shoulders of ${W} with a sleek chin-length bob haircut, front facing.`,
  long: `Head and shoulders of ${W} with long layered hair falling past the shoulders, front facing.`,
  curls: `Head and shoulders of ${W} with natural curly hair, front facing.`,
  pixie: `Head and shoulders of ${W} with a short pixie crop haircut, front facing.`,
  buzz: `Head and shoulders of ${M} with a neat buzz cut, front facing.`,
  slick: `Head and shoulders of ${M} with slicked-back hair, front facing.`,
  braid: `${W} seen from the front with one long braid resting over her shoulder, head and shoulders.`,
  dutch: `Head and shoulders of ${W} with two Dutch braids, front facing.`,
  crown: `Head and shoulders of ${W} with a crown braid wrapped around her head, front facing.`,
  boxbraids: `Head and shoulders of a woman in her twenties with long box braids, front facing.`,
  brows: `Close-up of ${W}'s eyes and full, soft, natural eyebrows, front facing, framed from forehead to cheekbones.`,
  straight: `Close-up of ${W}'s eyes with straight, flat, soft eyebrows, front facing, framed from forehead to cheekbones.`,
  arched: `Close-up of ${W}'s eyes with softly lifted, arched eyebrows, front facing, framed from forehead to cheekbones.`,
  bold: `Close-up of ${W}'s eyes with thick, bold, dark eyebrows, front facing, framed from forehead to cheekbones.`,
  mustache: `Head and shoulders of ${M} with a neat mustache and no beard, front facing.`,
  stubble: `Head and shoulders of ${M} with light even stubble, front facing.`,
  beard: `Head and shoulders of ${M} with a short, neatly trimmed beard, front facing.`,
  fullbeard: `Head and shoulders of ${M} with a full thick beard, front facing.`,
  goatee: `Head and shoulders of ${M} with a goatee, front facing.`,
  shaven: `Head and shoulders of ${M} who is clean-shaven with smooth skin, front facing.`,
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LOOKS).filter((id) => !fs.existsSync(path.join(OUT, id + ".jpg")));
fs.mkdirSync(OUT, { recursive: true });
async function one(id) {
  const scene = LOOKS[id]; if (!scene) return console.error("unknown", id);
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "proxy-injected") },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-sunburst", prompt: `${scene} ${STYLE}`, size: "1024x1024", quality: "medium", output_format: "jpeg", output_compression: 80, n: 1 }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.[0]?.b64_json) return console.error(id, "FAILED", r.status, JSON.stringify(j).slice(0, 200));
  const f = path.join(OUT, id + ".jpg"); fs.writeFileSync(f, Buffer.from(j.data[0].b64_json, "base64"));
  try { execFileSync("convert", [f, "-resize", "512x512", "-quality", "80", f]); } catch { /* keep the original size */ }
  console.log(id, "ok", fs.statSync(f).size);
}
for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(one)); // 4 at a time
