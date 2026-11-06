// Points every call-to-action button on the landing at the funnel (the app). DRY=1 only prints the plan, nothing is written.
//   FRAMER_API_KEY=... DRY=1 node links.mjs      # look first
//   FRAMER_API_KEY=... node links.mjs            # apply (then publish with pub.mjs)
// Buttons in master components (header, footer) cannot be changed through the API: fix those by hand in Framer.
import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
const FUNNEL_URL = process.env.APP_URL || "https://facetwin-demo.vercel.app/";
const LINK_KEY = "d2Byl4yc3", LABEL_KEY = "VKblOlE_u"; // the template Button's "link" and "label" controls (same ids as apply.mjs)
const CTA = /upload|selfie|try|start|get |free|retouch|begin|app|download|see it|show me/i;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
const stats = { set: 0, same: 0, skipped: 0, fail: 0 }, log = [];
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
async function walk(n, bp) {
  if (n.__class === "ComponentInstanceNode" && n.controls && typeof n.controls[LINK_KEY] === "string") {
    const link = n.controls[LINK_KEY], label = norm(n.controls[LABEL_KEY] || "");
    const isOld = /vercel\.app|facetwin-git/.test(link) && link !== FUNNEL_URL;
    const isEmpty = link === "" || link === "#";
    const isCta = CTA.test(label) && !/^mailto:/.test(link) && !/privacy|terms/i.test(link);
    if (link === FUNNEL_URL) stats.same++;
    else if (isOld || isEmpty || isCta) {
      log.push(`[${bp}] "${label || n.name}" ${n.id}: ${link || "(empty)"} -> funnel`); stats.set++;
      if (!DRY) { try { await n.setAttributes({ controls: { [LINK_KEY]: FUNNEL_URL } }); } catch (e) { stats.fail++; log.push("  FAIL " + e.message.split("\n")[0]); } }
    } else { stats.skipped++; log.push(`[${bp}] left alone: "${label || n.name}" -> ${link.slice(0, 80)}`); }
  }
  for (const k of await kids(n)) await walk(k, bp);
}
try {
  const home = await framer.getNode("augiA20Il"); // the home page; its children are the Desktop / Tablet / Phone breakpoints
  for (const bp of await kids(home)) await walk(bp, bp.name || bp.id);
} finally { await framer.disconnect(); }
console.log(log.join("\n"));
console.log(`\nFunnel link: ${FUNNEL_URL}\nSTATS ${JSON.stringify(stats)} ${DRY ? "(DRY RUN, nothing changed)" : "(APPLIED, now run pub.mjs)"}`);
