// Copy pass across Desktop / Tablet / Phone: value-based text + control replacements. DRY=1 only prints.
import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const MAP = [
  ["Why filters feel fake.", "Less editing. More you."],
  ["Retouch that keeps you you", "Retouch that still looks like you"],
  ["Your selfie. Three simple steps.", "Three steps. About ten seconds."],
  ["Your selfie. A little more polished.", "A quick touch-up, not a makeover."],
  ["A quick touch-up before you post. Soften distractions", "Fix what bugs you before you post, and keep everything that makes it you."],
  ["Lighten the look of teeth without brushing", "Whiten teeth a few shades to a natural off-white. Shape and gaps stay."],
  ["Adjust the look of freckles to suit", "Add light freckles or soften them. Your moles stay."],
  ["Add a soft glow when your photo needs", "A warmer, healthier tone and a soft highlight, in your own light."],
  ["Choose a studio background to keep the focus", "White, grey, blurred or passport style. Your face stays untouched."],
  ["Then $19.99 a month. Unlimited natural retouch", "Then $19.99 a month. Renews until you cancel. Unlimited natural retouch and Studio backgrounds."],
  ["Then $44.99 every 3 months, that is $15.00", "Then $44.99 every 3 months ($15.00 a month). Renews until you cancel. Same Glow plan, 25% cheaper per month."],
  ["Frequently Asked Questions", "Questions, answered"],
  ["Talk to us", "Questions?"],
  ["Our team is here to help you personally", "Write to us at hello@facetwin.app."],
  ["Contact Us", "Email us"],
];
const pick = (s) => { const n = norm(s); for (const [o, nw] of MAP) if (n === o || (o.length >= 28 && n.startsWith(o))) return nw; return null; };
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const log = []; let nText = 0, nCtrl = 0, nPair = 0;
async function walk(n, bp) {
  if (n.__class === "TextNode") {
    let t = null; try { t = await n.getText(); } catch {}
    const nw = t && pick(t);
    if (nw && norm(t) !== norm(nw)) { nText++; log.push(`${bp} text ${n.id}: "${norm(t).slice(0, 44)}" -> "${nw.slice(0, 60)}"`); if (!DRY) await n.setText(nw); }
    // founder-card remnant in the add-ons block: "facetwin." + "Add-ons are optional"
    if (t && norm(t) === "Add-ons are optional") {
      const par = await framer.getParent(n.id).catch(() => null); const sibs = par ? await kids(par) : [];
      for (const s of sibs) if (s.__class === "TextNode" && s.id !== n.id) { let st = ""; try { st = norm(await s.getText()); } catch {} if (st === "facetwin.") { nPair++; log.push(`${bp} pair ${s.id}/${n.id}: "facetwin." + "Add-ons are optional" -> "Looks and Coach" + "Optional, one-time, no renewal"`); if (!DRY) { await s.setText("Looks and Coach"); await n.setText("Optional, one-time, no renewal"); } } }
    }
  } else if (n.__class === "ComponentInstanceNode" && n.controls) {
    const upd = {};
    for (const [k, v] of Object.entries(n.controls)) { if (typeof v !== "string" || /^(https?:|mailto:|\/)/.test(v)) continue; const nw = pick(v); if (nw && norm(v) !== norm(nw)) upd[k] = nw; }
    if (Object.keys(upd).length) { nCtrl++; log.push(`${bp} ctrl ${n.id} ${n.name}: ${JSON.stringify(upd).slice(0, 150)}`); if (!DRY) await n.setAttributes({ controls: upd }); }
  }
  for (const c of await kids(n)) await walk(c, bp);
}
try {
  const home = (await framer.getNodesWithType("WebPageNode")).find((p) => p.path === "/");
  for (const bp of await kids(home)) await walk(bp, bp.name);
} finally { await framer.disconnect(); }
console.log(log.join("\n")); console.log(`\ntext ${nText} | controls ${nCtrl} | pairs ${nPair} ${DRY ? "(DRY RUN)" : "(APPLIED)"}`);
