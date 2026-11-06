import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const hits = [];
async function walk(n, chain) {
  const here = [...chain, `${n.name || n.__class}`];
  if (n.name === "FAQ Block" || n.name === "FAQ item") {
    if (n.name === "FAQ Block") { const ks = await kids(n); hits.push({ id: n.id, cls: n.__class, path: here.slice(-5).join(" > "), kids: ks.length, q: ks.map((k) => (k.controls?.ZTSB2GK72 || "").slice(0, 18)).join(" | ") }); }
    if (n.name === "FAQ item") return;
  }
  for (const k of await kids(n)) await walk(k, here);
}
try { await walk(await framer.getNode("augiA20Il"), []); } finally { await framer.disconnect(); }
for (const h of hits) console.log(`${h.id} ${h.cls} kids=${h.kids} | ${h.path}\n    ${h.q}`);
