// GET /api/verify?cs=<checkout session id> -> {paid, plan, tier, value, currency, customer, token}
// The browser calls this after Stripe redirects back. Access is granted only if Stripe says the session is paid,
// so a hand-typed URL can't unlock anything.
import * as S from "./_stripe.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const cs = S.queryOf(req).get("cs") || "";
  if (!/^(cs_(test|live)_[A-Za-z0-9]+|mock_[a-z_]+_[a-z0-9]+)$/.test(cs)) return res.status(400).json({ error: "Bad session id" });

  if (cs.startsWith("mock_")) {
    if (!S.MOCK) return res.status(400).json({ error: "Mock sessions are off" });
    const plan = cs.replace(/^mock_/, "").replace(/_[a-z0-9]+$/, "");
    if (!S.PLAN_IDS.includes(plan)) return res.status(400).json({ error: "Unknown plan" });
    const customer = "cus_mock";
    return res.status(200).json({ paid: true, plan, tier: S.tierOf(plan), value: null, currency: "USD", customer, token: S.sign(customer), mock: true });
  }
  if (!S.configured()) return res.status(503).json({ error: "Payments are not set up yet." });
  try {
    const s = await S.stripe(`checkout/sessions/${cs}`, null, "GET");
    const paid = s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
    const plan = (s.metadata && s.metadata.plan) || null;
    if (!paid || !S.PLAN_IDS.includes(plan)) return res.status(200).json({ paid: false });
    res.status(200).json({
      paid: true, plan, tier: S.tierOf(plan),
      value: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
      currency: (s.currency || "usd").toUpperCase(),
      customer: s.customer, token: S.sign(s.customer),
      email: (s.customer_details && s.customer_details.email) || null,
    });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
