import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const strings = [], faq = [], counts = { nodes: 0 };
async function walk(n, bp) {
  counts.nodes++;
  if (n.__class === "TextNode") { try { const t = await n.getText(); if (t && t.trim()) strings.push({ bp, id: n.id, t: t.replace(/\s+/g, " ").trim() }); } catch {} }
  if (n.__class === "ComponentInstanceNode" && n.controls) {
    for (const [k, v] of Object.entries(n.controls)) if (typeof v === "string" && v.length > 1 && !/^[A-Za-z0-9_]{9}$/.test(v)) strings.push({ bp, id: n.id, ctrl: k, t: v.replace(/\s+/g, " ").trim() });
    if (n.name === "FAQ item") faq.push({ bp, q: n.controls.ZTSB2GK72 });
  }
  for (const k of await kids(n)) await walk(k, bp);
}
try {
  const home = await framer.getNode("augiA20Il");
  for (const top of await kids(home)) await walk(top, top.name);
  const info = await framer.getProjectInfo(); console.log("project:", info.name, "| nodes on home:", counts.nodes);
} finally { await framer.disconnect(); }
const OLD = /sensoria|neural|dermal|ritual|vitality|biolog|bio-marker|luna|template|climate|humidity/i;
const left = strings.filter((s) => OLD.test(s.t));
console.log("\nLEFTOVER template wording on the home page:", left.length);
for (const s of left.slice(0, 20)) console.log(`  [${s.bp}] ${s.id}${s.ctrl ? " ctrl=" + s.ctrl : ""}: ${s.t.slice(0, 90)}`);
const links = strings.filter((s) => /^(https?:|mailto:|\/)/.test(s.t));
console.log("\nLINK-like values:"); for (const s of links.slice(0, 20)) console.log(`  [${s.bp}] ${s.ctrl}: ${s.t.slice(0, 110)}`);
console.log("\nFAQ items per breakpoint:"); const by = {}; for (const f of faq) (by[f.bp] ||= []).push(f.q); for (const [bp, qs] of Object.entries(by)) console.log(`  ${bp}: ${qs.length} -> ${qs.map((q) => String(q).slice(0, 26)).join(" | ")}`);
const want = ["Fix your selfie in one tap", "Retouch that keeps you you", "Pick a retouch", "See it [in seconds]", "Simple pricing. Cancel anytime.", "Natural retouches", "Seconds per edit, typical", "Questions, answered"];
console.log("\nNEW copy present (count over 3 breakpoints):"); for (const w of want) console.log(`  ${strings.filter((s) => s.t.includes(w)).length}x  ${w}`);
