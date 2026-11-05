// GET /api/verify?cs=<checkout session id>
//   plan session   -> {paid, kind: "plan",   plan, tier, value, currency, customer, token, email?}
//   add-on session -> {paid, kind: "upsell", item, skip, value, currency, customer, token, email?}
// The browser calls this after Stripe redirects back. Access is granted only if Stripe says the session is paid,
// so a hand-typed URL can't unlock anything.
import * as S from "./_stripe.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const cs = S.queryOf(req).get("cs") || "";
  if (!/^(cs_(test|live)_[A-Za-z0-9]+|mock_[a-z_]+_[a-z0-9]+)$/.test(cs)) return res.status(400).json({ error: "Bad session id" });

  if (cs.startsWith("mock_")) {
    if (!S.mockOn()) return res.status(400).json({ error: "Mock sessions are off" });
    const what = cs.replace(/^mock_/, "").replace(/_[a-z0-9]+$/, ""); // "glow_m" | "upsell_looks" | "upsell_coach_skip"
    const customer = "cus_mock", base = { paid: true, value: null, currency: "USD", customer, token: S.sign(customer), mock: true };
    if (what.startsWith("upsell_")) {
      const skip = what.endsWith("_skip"), item = what.slice(7).replace(/_skip$/, "");
      if (!S.UPSELL_IDS.includes(item)) return res.status(400).json({ error: "Unknown add-on" });
      return res.status(200).json({ ...base, kind: "upsell", item, skip });
    }
    if (!S.PLAN_IDS.includes(what)) return res.status(400).json({ error: "Unknown plan" });
    return res.status(200).json({ ...base, kind: "plan", plan: what, tier: S.tierOf(what) });
  }
  if (!S.configured()) return res.status(503).json({ error: "Payments are not set up yet." });
  try {
    const s = await S.stripe(`checkout/sessions/${cs}`, null, "GET");
    const paid = s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
    const m = s.metadata || {};
    const common = {
      paid: true,
      value: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
      currency: (s.currency || "usd").toUpperCase(),
      customer: s.customer, token: S.sign(s.customer),
      email: (s.customer_details && s.customer_details.email) || null,
    };
    if (m.kind === "upsell") {
      if (!paid || !S.UPSELL_IDS.includes(m.item)) return res.status(200).json({ paid: false });
      return res.status(200).json({ ...common, kind: "upsell", item: m.item, skip: m.skip === "1" });
    }
    if (!paid || !S.PLAN_IDS.includes(m.plan)) return res.status(200).json({ paid: false });
    res.status(200).json({ ...common, kind: "plan", plan: m.plan, tier: S.tierOf(m.plan) });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
