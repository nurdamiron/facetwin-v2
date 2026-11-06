import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
const QA = {
  "How accurate is the neural scan?": ["Will it look fake?", "Edits are designed to keep your face shape, skin texture and expression. If one looks off, tap Try again; your first two edits are free."],
  "Can I use my current products?": ["Is my photo stored?", "Your photo is sent to Google's Gemini AI only when you tap Show me, and only with your OK. We don't keep it on our servers; your photos stay in your browser and you can delete them anytime."],
  "Is it suitable for sensitive skin?": ["How much does it cost?", "Two edits are free. Glow is $9.99 for the first month, then $19.99 a month, or $22.49 for the first quarter, then $44.99 every 3 months. It renews until you cancel."],
  "How often should I scan my skin?": ["How do I cancel?", "In Settings, tap Manage subscription: two taps, no emails needed. We remind you 3 days before a renewal."],
  "What if my local climate changes?": ["Which photos work best?", "A clear, front-facing selfie in daylight with your whole face in frame. Use your own photo, or one you have permission to edit."],
};
// Numbers block: the three facts that decide whether she taps (label, from, to, suffix)
const NUMBERS = { "Natural retouches": [0, 10, "s", "Typical edit"], "Studio backgrounds": [0, 2, "", "Free edits"], "Seconds per edit, typical": [0, 12, "", "Edits to choose from"] };
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
const log = []; let nf = 0, nn = 0;
async function walk(n, bp) {
  if (n.__class === "ComponentInstanceNode" && n.controls) {
    const c = n.controls;
    if ("ZTSB2GK72" in c && QA[norm(c.ZTSB2GK72)]) { const [q, a] = QA[norm(c.ZTSB2GK72)]; nf++; log.push(`${bp} faq ${n.id}: ${q}`); if (!DRY) await n.setAttributes({ controls: { ZTSB2GK72: q, YiO2oBlbb: a } }); }
    const lab = c.oQLXoYWFl; if (lab && NUMBERS[norm(lab)]) { const [f, t, suf, nl] = NUMBERS[norm(lab)]; nn++; log.push(`${bp} number ${n.id}: ${nl} -> ${t}${suf}`); if (!DRY) await n.setAttributes({ controls: { gYZJKjgB2: f, Bd3SgYY7x: t, zfTPlTmPF: suf, oQLXoYWFl: nl } }); }
  }
  for (const k of await kids(n)) await walk(k, bp);
}
try {
  const home = (await framer.getNodesWithType("WebPageNode")).find((p) => p.path === "/");
  for (const bp of await kids(home)) if (["Desktop", "Tablet", "Phone"].includes(bp.name)) await walk(bp, bp.name);
} finally { await framer.disconnect(); }
console.log(log.join("\n")); console.log(`faq ${nf} | numbers ${nn} ${DRY ? "(DRY)" : "(APPLIED)"}`);
