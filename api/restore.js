// POST /api/restore: get a purchase back on a new browser, phone or after clearing site data. Two steps, no database:
//   {action: "send",   email}        emails a 6-digit code to that address (only if a paying customer exists for it; the answer is always {ok: true}
//                                    so nobody can probe which emails are customers)
//   {action: "verify", email, code}  checks the code, then asks Stripe what that email has paid for:
//                                    -> {plan: "glow_m"|"glow_q"|null, owned: {looks?, coach?}, customer, token}   (same token as /api/verify)
// The code is an HMAC of (email, 10-minute window) with a server secret, so it needs no storage; it is accepted for the current and the
// previous window (10 to 20 minutes). An email address alone never unlocks anything: the code only reaches the owner of the mailbox.
// Best-effort limits (in memory): 3 codes per email per hour, 10 sends per IP per hour, 6 wrong codes per email per 15 minutes.
// Needs RESEND_API_KEY + MAIL_FROM (api/_mail.js). With STRIPE_MOCK on (never in production) the code is 000000 and nothing is mailed.
import crypto from "node:crypto";
import * as S from "./_stripe.js";
import { mailConfigured, sendMail } from "./_mail.js";

const WINDOW = 600_000, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sends = new Map(), ipSends = new Map(), fails = new Map(); // key -> [timestamps]
const hit = (map, key, windowMs, max, add = true) => {
  const now = Date.now(), list = (map.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { map.set(key, list); return false; }
  if (add) list.push(now);
  map.set(key, list); if (map.size > 5000) map.clear();
  return true;
};
const codeKey = () => crypto.createHash("sha256").update("facetwin-restore:" + (S.secret() || "mock")).digest();
const codeFor = (email, win) => {
  const n = crypto.createHmac("sha256", codeKey()).update(`${email}:${win}`).digest().readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
};
const codeOk = (email, code) => {
  const w = Math.floor(Date.now() / WINDOW);
  return [w, w - 1].some((x) => { const a = Buffer.from(codeFor(email, x)), b = Buffer.from(String(code)); return a.length === b.length && crypto.timingSafeEqual(a, b); });
};

// What has this email paid for? Looks at up to 5 Stripe customers with that email: an active/trialing Glow subscription, and paid add-on sessions.
export async function entitlementsFor(email) {
  const seen = new Map();
  for (const e of new Set([email, email.toLowerCase()])) for (const c of (await S.stripe("customers", { email: e, limit: 5 }, "GET")).data || []) seen.set(c.id, c);
  let plan = null, planCustomer = null, firstCustomer = null; const owned = {};
  for (const id of [...seen.keys()].slice(0, 5)) {
    const subs = (await S.stripe("subscriptions", { customer: id, status: "all", limit: 10 }, "GET")).data || [];
    for (const s of subs) {
      if (!["active", "trialing"].includes(s.status)) continue;
      const price = s.items && s.items.data && s.items.data[0] && s.items.data[0].price && s.items.data[0].price.id;
      const p = S.PLAN_IDS.find((x) => S.priceFor(x) === price);
      if (p && (!plan || p === "glow_q")) { plan = p; planCustomer = id; }
    }
    const sess = (await S.stripe("checkout/sessions", { customer: id, limit: 50 }, "GET")).data || [];
    for (const x of sess) {
      const m = x.metadata || {};
      const paid = x.status === "complete" && (x.payment_status === "paid" || x.payment_status === "no_payment_required");
      if (paid && m.kind === "upsell" && S.UPSELL_IDS.includes(m.item)) { owned[m.item] = 1; firstCustomer = firstCustomer || id; }
    }
  }
  const customer = planCustomer || firstCustomer;
  return { plan, owned, customer, found: !!(plan || Object.keys(owned).length) };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: "Not allowed" }); } catch { return res.status(403).json({ error: "Not allowed" }); } }
  const b = S.bodyOf(req), email = String(b.email || "").trim().slice(0, 200), mock = S.mockOn();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Check your email address" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const key = email.toLowerCase();

  if (b.action === "send") {
    if (!mock && !(mailConfigured() && S.configured())) return res.status(503).json({ error: "Restoring by email isn't set up yet. Write to " + (process.env.SUPPORT_EMAIL || "our support") + " with the email you paid with." });
    if (!hit(sends, key, 3_600_000, 3) || !hit(ipSends, ip, 3_600_000, 10)) return res.status(429).json({ error: "Too many tries. Please wait an hour or write to support." });
    if (mock) return res.status(200).json({ ok: true, mock: true });
    try {
      const ent = await entitlementsFor(email);
      if (ent.found) await sendMail({ to: email, subject: "Your FaceTwin code", text: `Your FaceTwin code is ${codeFor(key, Math.floor(Date.now() / WINDOW))}.\n\nIt works for about 15 minutes. If you didn't ask for it, ignore this email: nothing changes.` });
    } catch { return res.status(502).json({ error: "We couldn't send the code. Try again in a minute." }); }
    return res.status(200).json({ ok: true }); // the same answer whether or not the email is a customer
  }

  if (b.action === "verify") {
    const code = String(b.code || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code" });
    if (!hit(fails, key, 900_000, 6, false)) return res.status(429).json({ error: "Too many wrong codes. Please wait 15 minutes." });
    const good = mock ? code === "000000" : codeOk(key, code);
    if (!good) { hit(fails, key, 900_000, 6); return res.status(403).json({ error: "That code isn't right or has expired." }); }
    if (mock) {
      if (/^none@/i.test(email)) return res.status(404).json({ error: "We couldn't find a paid plan for this email." });
      return res.status(200).json({ plan: "glow_q", owned: { looks: 1 }, customer: "cus_mock", token: S.sign("cus_mock"), mock: true });
    }
    try {
      const ent = await entitlementsFor(email);
      if (!ent.found) return res.status(404).json({ error: "We couldn't find a paid plan for this email." });
      return res.status(200).json({ plan: ent.plan, owned: ent.owned, customer: ent.customer, token: S.sign(ent.customer) });
    } catch { return res.status(502).json({ error: "We couldn't check your payment. Try again in a minute." }); }
  }
  return res.status(400).json({ error: "Unknown action" });
}
