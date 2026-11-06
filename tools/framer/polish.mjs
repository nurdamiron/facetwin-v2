import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const log = [], norm = (s) => String(s).replace(/\s+/g, " ").trim();
const remove = [], pageLinks = [];
async function walk(n, where) {
  if (n.__class === "FrameNode" && n.name === "Custom Plan") remove.push({ id: n.id, where });
  if (n.__class === "TextNode") {
    let t = ""; try { t = norm(await n.getText()); } catch {}
    let nw = null;
    if (/faceswap apps/i.test(t)) nw = "Why filters feel fake.";
    else if (/^hello@facetwin\.com$/i.test(t)) nw = "hello@facetwin.app";
    if (nw && nw !== t) { log.push(`text ${n.id} [${where}]: "${t.slice(0, 50)}" -> "${nw}"`); if (!DRY) await n.setText(nw); }
  }
  if (n.__class === "ComponentInstanceNode" && n.controls) {
    const upd = {};
    for (const [k, v] of Object.entries(n.controls)) {
      if (typeof v !== "string") continue;
      if (/mailto:.*sensoria|mailto:.*facetwin\.com/i.test(v)) upd[k] = "mailto:hello@facetwin.app";
      if (/^\/page(\/|$|#)/.test(v)) pageLinks.push(`${n.id} ${k}=${v}`);
    }
    if (Object.keys(upd).length) { log.push(`ctrl ${n.id} [${where}]: ${JSON.stringify(upd)}`); if (!DRY) await n.setAttributes({ controls: upd }); }
  }
  for (const c of await kids(n)) await walk(c, where);
}
try {
  const pages = await framer.getNodesWithType("WebPageNode");
  for (const pg of pages) for (const bp of await kids(pg)) await walk(bp, `${pg.path}:${bp.name}`);
  for (const r of remove) { log.push(`remove "Custom Plan" frame ${r.id} [${r.where}]`); }
  if (!DRY && remove.length) await framer.removeNodes(remove.map((r) => r.id));
  const extra = pages.find((p) => p.path === "/page");
  console.log("links to /page found:", pageLinks.length ? pageLinks.join(" ; ") : "none");
} finally { await framer.disconnect(); }
console.log(log.join("\n") || "nothing to change"); console.log(DRY ? "(DRY RUN)" : "(APPLIED)");
