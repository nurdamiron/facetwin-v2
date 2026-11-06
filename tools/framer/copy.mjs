import { connect } from "framer-api";
import fs from "node:fs";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const out = { Desktop: [], Tablet: [], Phone: [] };
async function walk(n, bp, sec) {
  const s = ["Hero", "About Us", "Analysis", "Concept", "How it Works", "Results", "Pricing", "FAQ"].includes(n.name) || /highlights|touch|Section|CTA|Footer|Problem/i.test(n.name || "") ? n.name : sec;
  if (n.__class === "TextNode") { try { const t = norm(await n.getText() || ""); if (t) out[bp].push({ sec: s, id: n.id, t }); } catch {} }
  if (n.__class === "ComponentInstanceNode" && n.controls) for (const [k, v] of Object.entries(n.controls)) if (typeof v === "string" && v.length > 1 && !/^[A-Za-z0-9_]{9}$/.test(v) && !/^(https?:|\/|mailto:|rgb)/.test(v) && !["none", "integer", "comma"].includes(v)) out[bp].push({ sec: s, id: n.id, t: norm(v), ctrl: n.name });
  for (const c of await kids(n)) await walk(c, bp, s);
}
try {
  const home = (await framer.getNodesWithType("WebPageNode")).find((p) => p.path === "/");
  for (const bp of await kids(home)) if (out[bp.name]) await walk(bp, bp.name, "top");
} finally { await framer.disconnect(); }
fs.writeFileSync("copy.json", JSON.stringify(out, null, 1));
for (const k of Object.keys(out)) console.log(k, out[k].length);
