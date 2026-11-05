// POST /api/portal {customer, token} -> {url}. Stripe Customer Portal: change plan, update card, cancel in 2 taps.
// Turn the portal on once in Stripe Dashboard -> Settings -> Billing -> Customer portal (test mode too).
import * as S from "./_stripe.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = S.bodyOf(req);
  const customer = String(b.customer || "");
  if (!/^cus_[A-Za-z0-9]+$/.test(customer) || !S.checkSign(customer, b.token)) return res.status(403).json({ error: "Not allowed" });
  const origin = S.originOf(req);
  if (S.mockOn() && customer === "cus_mock") return res.status(200).json({ url: `${origin}/#/account`, mock: true });
  if (!S.configured()) return res.status(503).json({ error: "Payments are not set up yet." });
  try {
    // STRIPE_PORTAL_CONFIG comes from scripts/stripe-setup.js; without it Stripe uses the Dashboard's default portal
    const configuration = (process.env.STRIPE_PORTAL_CONFIG || "").trim() || undefined;
    const p = await S.stripe("billing_portal/sessions", { customer, return_url: `${origin}/#/account`, configuration });
    res.status(200).json({ url: p.url });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
