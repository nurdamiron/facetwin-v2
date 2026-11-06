// Builds assets/landing-icons/NN-*.svg (Hugeicons Free, MIT) for the nine highlight cards. Order = card order.
//   npm pack @hugeicons/core-free-icons && tar xzf hugeicons-core-free-icons-*.tgz
//   node tools/framer/icons-build.mjs ./package/dist/esm
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const SRC = path.resolve(process.argv[2] || "./package/dist/esm");
const OUT = path.resolve(import.meta.dirname, "../../assets/landing-icons");
const ICONS = [
  ["01-clearskin", "AiBeautify"],      // Clearer skin: retouch wand
  ["02-undereye", "ScanEye"],          // Fresher eyes
  ["03-teeth", "DentalTooth"],         // Brighter smile
  ["04-freckles", "MoreHorizontal"],   // Freckles on or off: dots
  ["05-glow", "Sun01"],                // Healthy glow
  ["06-background", "AiBackgroundEraser"], // Clean backgrounds: person on a new background
  ["07-softerlines", "AiEraser"],      // Softer lines: eraser
  ["08-smile", "Smile"],               // Same expression
  ["09-identity", "FaceId"],           // Still you
];
const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".svg")) fs.unlinkSync(path.join(OUT, f));
for (const [file, name] of ICONS) {
  const mod = await import(pathToFileURL(path.join(SRC, `${name}Icon.js`)).href);
  const body = mod.default.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${kebab(k)}="${String(v).replace("currentColor", "#7C4DFF")}"`).join(" ")}/>`).join("");
  fs.writeFileSync(path.join(OUT, file + ".svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">${body}</svg>\n`);
  console.log(file, "<-", name);
}
