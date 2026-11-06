// Real AI check: runs the production /api/edit code path against the real Gemini or OpenAI API, with a photo of your choice.
// The key is read from the environment only (GEMINI_API_KEY or OPENAI_API_KEY); it is never printed or written anywhere.
//
//   PowerShell:  $env:GEMINI_API_KEY="..."; node scripts/test-ai.mjs
//                $env:OPENAI_API_KEY="..."; $env:AI_PROVIDER="openai"; node scripts/test-ai.mjs
//   options:     node scripts/test-ai.mjs [photo.jpg] [editId ...]     (default photo: tests/faces/face03.jpg, default edit: onetap)
//                node scripts/test-ai.mjs --all                         (the 8 Glow retouches; costs 8 generations)
//   result:      ai-test-out/<edit>.jpg|png next to a copy of the original, plus a printed verdict
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREVIEWS } from "../previews.js";
import { aiProvider } from "../api/_ai.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), all = args.includes("--all");
const rest = args.filter((a) => !a.startsWith("--"));
const photo = rest.find((a) => /\.(jpe?g|png|webp)$/i.test(a)) || path.join(ROOT, "tests/faces/face03.jpg");
const ids = all ? PREVIEWS.filter((p) => p.group === "Glow").map((p) => p.id) : (rest.filter((a) => !/\.(jpe?g|png|webp)$/i.test(a)).length ? rest.filter((a) => !/\.(jpe?g|png|webp)$/i.test(a)) : ["onetap"]);

delete process.env.AI_MOCK; // this script is about the real thing
const ai = aiProvider();
if (!ai) { console.error("No key found. Set GEMINI_API_KEY (or OPENAI_API_KEY) in this terminal first. See the header of this file."); process.exit(1); }
const { default: handler } = await import("../api/edit.js");

const out = path.join(ROOT, "ai-test-out"); fs.mkdirSync(out, { recursive: true });
const buf = fs.readFileSync(photo), mime = /\.png$/i.test(photo) ? "image/png" : /\.webp$/i.test(photo) ? "image/webp" : "image/jpeg";
fs.copyFileSync(photo, path.join(out, "original" + path.extname(photo)));
console.log(`Provider: ${ai.name}  model: ${ai.model}  photo: ${path.basename(photo)} (${Math.round(buf.length / 1024)} KB)  edits: ${ids.join(", ")}\n`);

let okCount = 0;
for (const id of ids) {
  if (!PREVIEWS.some((p) => p.id === id)) { console.log(`- ${id}: unknown edit id`); continue; }
  const res = { statusCode: 200, body: undefined, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
  const req = { method: "POST", headers: { host: "localhost" }, socket: { remoteAddress: "127.0.0.1" }, body: { image: buf.toString("base64"), mime, id } };
  const t0 = Date.now();
  await handler(req, res);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.statusCode !== 200 || !res.body?.image) { console.log(`- ${id}: FAILED (HTTP ${res.statusCode}) ${res.body?.error || ""}`); continue; }
  const ext = res.body.mime === "image/png" ? "png" : res.body.mime === "image/webp" ? "webp" : "jpg";
  const file = path.join(out, `${id}.${ext}`); const bytes = Buffer.from(res.body.image, "base64"); fs.writeFileSync(file, bytes);
  const same = bytes.equals(buf);
  console.log(`- ${id}: ${same ? "returned the SAME photo (no edit)" : "OK"}  ${secs}s  ${Math.round(bytes.length / 1024)} KB  -> ai-test-out/${id}.${ext}`);
  if (!same) okCount++;
}
console.log(`\n${okCount}/${ids.length} edits produced an image. Open the ai-test-out folder and compare each result with original${path.extname(photo)}.`);
process.exit(okCount === ids.length ? 0 : 2);
