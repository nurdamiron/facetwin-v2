// POST /api/checkout {plan, email?, utm?} -> {url}. Opens Stripe Checkout for one of the 4 plans.
// Monthly plans get the first-month coupon (20% off once) when STRIPE_COUPON_FIRST_MONTH is set.
import * as S from "./_stripe.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!S.configured()) return res.status(503).json({ error: "Payments are not set up yet." });
  const b = S.bodyOf(req);
  const plan = String(b.plan || "");
  if (!S.PLAN_IDS.includes(plan)) return res.status(400).json({ error: "Unknown plan" });
  const origin = S.originOf(req);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email || "") ? String(b.email).slice(0, 200) : undefined;

  // first-touch ad attribution, kept on the Stripe customer / subscription for the cohort report
  const meta = { plan };
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) {
    if (b.utm && typeof b.utm[k] === "string" && b.utm[k]) meta[k] = b.utm[k].slice(0, 400);
  }

  if (S.MOCK) {
    const id = `mock_${plan}_${Date.now().toString(36)}`;
    return res.status(200).json({ url: `${origin}/?cs=${id}#/welcome`, mock: true });
  }
  const coupon = (process.env.STRIPE_COUPON_FIRST_MONTH || "").trim();
  try {
    const session = await S.stripe("checkout/sessions", {
      mode: "subscription",
      line_items: [{ price: S.priceFor(plan), quantity: 1 }],
      discounts: coupon && S.isMonthly(plan) ? [{ coupon }] : undefined,
      customer_email: email,
      success_url: `${origin}/?cs={CHECKOUT_SESSION_ID}#/welcome`,
      cancel_url: `${origin}/#/paywall`,
      metadata: meta,
      subscription_data: { metadata: meta },
      billing_address_collection: "auto",
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
