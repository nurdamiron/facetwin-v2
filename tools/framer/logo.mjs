import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
async function all(n, pred, out = []) { if (pred(n)) out.push(n); for (const k of await kids(n)) await all(k, pred, out); return out; }
try {
  const inst = await framer.getNode("WK8uzW56d"); if (!inst || inst.name !== "Logo") throw new Error("logo instance not found");
  const parent = await framer.getParent(inst.id); const index = (await kids(parent)).findIndex((s) => s.id === inst.id);
  const comps = await framer.getNodesWithType("ComponentNode"); const logo = comps.find((c) => c.name === "Logo");
  const copy = await framer.addDetachedComponentLayers({ url: logo.insertURL, layout: true });
  const texts = await all(copy, (n) => n.__class === "TextNode"); console.log("text nodes in logo copy:", texts.length);
  for (const t of texts) { const old = await t.getText(); if (/sensoria/i.test(old)) { await t.setText("facetwin."); console.log("renamed", JSON.stringify(old), "-> facetwin."); } }
  await framer.setParent(copy.id, parent.id, index); await framer.removeNodes([inst.id]); console.log("replaced in", parent.name);
  // any stray copy at breakpoint roots?
  const home = await framer.getNode("augiA20Il");
  for (const bp of await kids(home)) for (const k of await kids(bp)) if (k.__class === "FrameNode" && k.name === "Logo") { await framer.removeNodes([k.id]); console.log("removed stray Logo in", bp.name); }
} catch (e) { console.log("ERR", e.message.split("\n")[0]); } finally { await framer.disconnect(); }
