import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const OLD = /sensoria|neural|dermal|ritual|vitality|biolog|luna|liana|template|climate|humidity|download the app|facetwin\.com|iphone|native|custom scale|bigger vision|threads|instagram|linkedin|faceswap|face swap/i;
const rows = [];
async function walk(n, bp, path) {
  const here = path + "/" + (n.name || n.__class);
  if (n.__class === "TextNode") { try { const t = (await n.getText()) || ""; if (OLD.test(t)) rows.push({ bp, id: n.id, kind: "text", t: t.replace(/\s+/g, " ").trim(), path: here }); } catch {} }
  if (n.__class === "ComponentInstanceNode" && n.controls) for (const [k, v] of Object.entries(n.controls)) if (typeof v === "string" && OLD.test(v)) rows.push({ bp, id: n.id, kind: "ctrl:" + k, t: v.replace(/\s+/g, " ").trim(), path: here });
  for (const c of await kids(n)) await walk(c, bp, here);
}
try {
  const pages = await framer.getNodesWithType("WebPageNode");
  for (const pg of pages) { for (const bp of await kids(pg)) await walk(bp, `${pg.path}:${bp.name}`, ""); }
} finally { await framer.disconnect(); }
const seen = new Set(); let n = 0;
for (const r of rows) { const k = r.t.slice(0, 60) + "|" + r.kind; if (seen.has(k)) continue; seen.add(k); n++; console.log(`[${r.bp}] ${r.id} ${r.kind}: ${r.t.slice(0, 95)}\n      ${r.path.slice(-90)}`); if (n > 40) break; }
console.log("\nunique leftovers:", seen.size, "| total hits:", rows.length);
