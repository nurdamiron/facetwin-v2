// Phase 1: page-level copy + controls + links, and the FAQ block (detached copy). DRY=1 only prints the plan.
import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
const APP_URL = process.env.APP_URL || "https://facetwin-demo.vercel.app/?utm_source=framer&utm_medium=landing";
const EMAIL = "mailto:hello@facetwin.app";
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

// old text (exact, or a prefix of >= 30 chars) -> new text
const TEXT = [
  ["No more skin guessing.", "Fix your selfie in one tap. Natural retouch that still looks like you."],
  ["Intelligent neuro-beauty", "Natural retouch in seconds"],
  ["Sensoria AI", "FaceTwin"],
  ["Sensoria Team", "Add-ons"],
  ["Sensoria", "facetwin."],
  ["18'", "10s"],
  ["[About Us]", "[Glow]"],
  ["Smart analysis That adapts", "Retouch that keeps you you"],
  ["Stop guessing. Sensoria uses neural mapping", "Acne, under-eye bags, wrinkles, teeth and freckles fixed in about 10 seconds. Real skin texture stays, no plastic filter look."],
  ["Smart Analysis", "One-tap retouch"],
  ["High-precision neural mapping", "Eight natural retouches, from acne and spots to a soft studio glow."],
  ["Adaptive Rituals", "Studio backgrounds"],
  ["Dynamic routines that automatically adjust", "White, grey studio or a passport-style photo. Your face stays untouched."],
  ["I’ve adjusted your routine", "Background changed to clean white. Your face is unchanged."],
  ["Analyze my glow...", "Try another edit..."],
  ["Glow Tracking", "Looks and Coach"],
  ["Smart metrics to track your radiance", "Optional add-ons: try hairstyles on your 3D twin, or follow a 12-week face plan."],
  ["+14% Glow", "Example"],
  ["Vitality index:", "Typical edit time:"],
  ["Vitality index", "Example progress"],
  ["Jan", "W1"], ["Feb", "W2"], ["Mar", "W3"], ["Apr", "W4"], ["May", "W5"], ["Jun", "W6"],
  ["[Analysis]", "[Numbers]"],
  ["Intelligence", "What you get"],
  ["Our advanced neural engine processes", "Every edit keeps your face, skin texture and expression. We don't keep your photo on our servers; your photos stay in your browser."],
  ["[Concept]", "[Try it]"],
  ["Intelligent Beauty", "Your best selfie, in one tap"],
  ["Get Started", "Upload a selfie"],
  ["Simple Steps Smart Results", "Simple steps. Natural results."],
  ["Neural Scan", "Upload a selfie"],
  ["Our AI analyzes 100,000 dermal points", "One clear, front-facing photo. No sign-up."],
  ["Data Decode", "Pick a retouch"],
  ["We process environmental factors", "Acne, under-eye bags, wrinkles, teeth, freckles, glow or a studio background."],
  ["Custom Ritual", "Compare"],
  ["Receive a tailored skincare routine", "Drag the slider to see before and after. Edit again or try another look."],
  ["Live Sync", "Download in HD"],
  ["The system continuously monitors changes", "Glow plan: unlimited edits, HD download, no watermark."],
  ["Visible [in 7 days]", "See it [in seconds]"],
  ["Visible Progress", "Looks like you"],
  ["“Thanks to the redesign", "“Pores, freckles and moles stay. We retouch, we don't smooth you away.”"],
  ["The Approach", "Try it free"],
  ["Mira Rossi", "Our rule"],
  ["Verified User", "Natural by design"],
  ["Just 7 days and my skin looks better", "Real skin texture, pores and freckles stay. No plastic, no beauty-filter look."],
  ["82% → 96%", "about 10 seconds"],
  ["Select Plan Scalable Beauty", "Simple pricing. Cancel anytime."],
  ["We believe that advanced skincare technology", "After checkout you can add Looks ($29.99 once) and Coach ($24.99 once). One-time payments, no renewal. Prices in USD."],
  ["Alexandra Jensen", "FaceTwin"],
  ["Founder & CEO", "Add-ons are optional"],
  ["Frequently Asked Questions", "Questions, answered"],
  ["Talk to us", "Questions?"],
  ["Our team is here to help", "Write to us at hello@facetwin.app."],
  ["Contact Us", "Email us"],
  ["Try Sensoria", "Try it free"],
];
const pick = (s) => { const n = norm(s); for (const [o, nw] of TEXT) if (n === o || (o.length >= 22 && n.startsWith(o))) return nw; return null; };
const NUMBERS = { "Scan accuracy": [0, 8, "", "Natural retouches"], "Live monitoring": [0, 4, "", "Studio backgrounds"], "Sync speed": [0, 10, "s", "Seconds per edit, typical"] };
const BUTTONS = new Set(["Get Started", "The Approach", "Get template", "Try Sensoria"]);
const FAQ = [
  ["Will it look fake?", "Edits are designed to keep your face shape, skin texture and expression. If one looks off, tap Try again; your first two edits are free."],
  ["Is my photo stored?", "Your photo is sent to Google's Gemini AI only when you tap Show me, and only with your OK. We don't keep it on our servers; photos stay in your browser and you can delete them anytime."],
  ["How much does it cost?", "Two edits are free. Glow is $9.99 for the first month, then $19.99 a month, or $22.49 for the first quarter, then $44.99 every 3 months."],
  ["How do I cancel?", "In Settings, tap Manage subscription: two taps, no emails needed. We remind you 3 days before a renewal."],
  ["Which photos work best?", "A clear, front-facing selfie in daylight with your whole face in frame. No sunglasses or heavy filters."],
];

const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const log = [], stats = { text: 0, ctrl: 0, link: 0, fail: 0, faq: 0 };
const show = (kind, id, a, b) => log.push(`${kind} ${id}: ${norm(a).slice(0, 48)} -> ${norm(b).slice(0, 56)}`);
const faqBlocks = [];
async function walk(n) {
  if (n.__class === "TextNode") {
    let t = null; try { t = await n.getText(); } catch {}
    const nw = t && pick(t);
    if (nw && norm(t) !== norm(nw)) { show("text", n.id, t, nw); stats.text++; if (!DRY) { try { await n.setText(nw); } catch (e) { stats.fail++; log.push("  FAIL " + e.message.split("\n")[0]); } } }
  } else if (n.__class === "ComponentInstanceNode" && n.controls) {
    if (n.name === "FAQ Block") { faqBlocks.push(n); return; }
    const c = n.controls, upd = {};
    const label = c.VKblOlE_u, num = c.oQLXoYWFl;
    if (num && NUMBERS[norm(num)]) { const [f, t, suf, lab] = NUMBERS[norm(num)]; Object.assign(upd, { gYZJKjgB2: f, Bd3SgYY7x: t, zfTPlTmPF: suf, oQLXoYWFl: lab }); }
    for (const [k, v] of Object.entries(c)) {
      if (typeof v !== "string" || k in upd) continue;
      if (/^(\/|https?:|mailto:)/.test(v)) continue;
      const nw = pick(v); if (nw && norm(v) !== norm(nw)) upd[k] = nw;
    }
    if (label && BUTTONS.has(norm(label)) && typeof c.d2Byl4yc3 === "string" && c.d2Byl4yc3 !== APP_URL) { upd.d2Byl4yc3 = APP_URL; stats.link++; }
    if (label && norm(label) === "Contact Us" && typeof c.d2Byl4yc3 === "string") { upd.d2Byl4yc3 = EMAIL; stats.link++; }
    if (Object.keys(upd).length) {
      show("ctrl", n.id + " " + n.name, JSON.stringify(Object.keys(upd)), JSON.stringify(Object.values(upd)).slice(0, 60)); stats.ctrl++;
      if (!DRY) { try { await n.setAttributes({ controls: upd }); } catch (e) { stats.fail++; log.push("  FAIL " + e.message.split("\n")[0]); } }
    }
  }
  for (const k of await kids(n)) await walk(k);
}
try {
  const home = await framer.getNode("augiA20Il");
  for (const top of await kids(home)) await walk(top);
  // FAQ: replace each FAQ Block instance with an editable detached copy, in the same place
  const comps = await framer.getNodesWithType("ComponentNode"); const faqComp = comps.find((c) => c.name === "FAQ Block");
  for (const inst of faqBlocks) {
    stats.faq++; log.push(`faq ${inst.id}: replace with detached copy + ${FAQ.length} edited items`);
    if (DRY) continue;
    const parent = await framer.getParent(inst.id); const sibs = await kids(parent); const index = sibs.findIndex((s) => s.id === inst.id);
    const copy = await framer.addDetachedComponentLayers({ url: faqComp.insertURL, layout: true });
    const items = (await kids(copy)).filter((i) => i.__class === "ComponentInstanceNode");
    for (let i = 0; i < items.length && i < FAQ.length; i++) await items[i].setAttributes({ controls: { ZTSB2GK72: FAQ[i][0], YiO2oBlbb: FAQ[i][1] } });
    await framer.setParent(copy.id, parent.id, index);
    await framer.removeNodes([inst.id]);
  }
  // the detached insert also leaves a stray "FAQ Block" frame at the root of each breakpoint: remove them
  if (!DRY) for (const bp of await kids(await framer.getNode("augiA20Il"))) for (const k of await kids(bp)) if (k.__class === "FrameNode" && k.name === "FAQ Block") { await framer.removeNodes([k.id]); log.push("removed stray FAQ Block in " + bp.name); }
} finally { await framer.disconnect(); }
console.log(log.slice(0, 200).join("\n")); console.log("\nSTATS", JSON.stringify(stats), DRY ? "(DRY RUN, nothing changed)" : "(APPLIED)");
