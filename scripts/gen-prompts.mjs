// Rewrites section 3 of PROMPTS.md from previews.js, so the hand test in Google AI Studio always uses
// the exact texts the app sends (Glow, Studio, hair, braids, brows, beard).
//   node scripts/gen-prompts.mjs          rewrite PROMPTS.md
//   node scripts/gen-prompts.mjs --check  exit 1 if PROMPTS.md is out of date (used by the tests)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, PREVIEWS, promptFor } from "../previews.js";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "PROMPTS.md");
const START = "## 3. The prompts (copy the whole block)";
const END = "## 4. Score each result (write it down)";

export function section() {
  const lines = [START, ""];
  lines.push("Glow and Studio are the paid retouch product: start with those. Each block is exactly what the app sends with the photo.", "");
  for (const g of GROUPS) {
    for (const p of PREVIEWS.filter((x) => x.group === g && x.id !== "custom")) {
      lines.push(`### ${p.name}  ·  ${g}`, "", "```", promptFor(p.id), "```", "");
    }
  }
  lines.push('### Your idea  ·  free text', "", "Type your own change after this base, e.g. \"a short curly fade and a thin mustache\":", "", "```",
    promptFor("custom", "<your change>"), "```", "");
  return lines.join("\n");
}

export function render(md) {
  const a = md.indexOf(START), b = md.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error("PROMPTS.md: section 3 markers not found");
  return md.slice(0, a) + section() + "\n" + md.slice(b);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = fs.readFileSync(FILE, "utf8"), next = render(md);
  if (process.argv.includes("--check")) { if (md !== next) { console.error("PROMPTS.md is out of date: run node scripts/gen-prompts.mjs"); process.exit(1); } console.log("PROMPTS.md is up to date"); }
  else { fs.writeFileSync(FILE, next); console.log(`PROMPTS.md updated (${PREVIEWS.length - 1} prompts)`); }
}
