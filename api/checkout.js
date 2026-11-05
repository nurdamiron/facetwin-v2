// POST /api/checkout -> {url}. Opens Stripe Checkout.
//   subscription: {plan: "glow_m" | "glow_q", email?, utm?}. The first period gets its fixed-amount coupon when set.
//   add-on:       {kind: "upsell", item: "looks" | "coach", skip?: true, customer?, token?}. One-time payment; `skip` uses the
//                 second-chance price that the app only offers after she declined the first one.
import * as S from "./_stripe.js";

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = S.bodyOf(req);
  const origin = S.originOf(req);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email || "") ? String(b.email).slice(0, 200) : undefined;

  // first-touch ad attribution, kept on the Stripe customer / subscription for the cohort report
  const utm = {};
  for (const k of UTM) if (b.utm && typeof b.utm[k] === "string" && b.utm[k]) utm[k] = b.utm[k].slice(0, 400);

  if (b.kind === "upsell") return upsell(b, origin, email, utm, res);

  if (!S.configured()) return res.status(503).json({ error: "Payments are not set up yet." });
  const plan = String(b.plan || "");
  if (!S.PLAN_IDS.includes(plan)) return res.status(400).json({ error: "Unknown plan" });
  const meta = { plan, ...utm };

  if (S.mockOn()) {
    const id = `mock_${plan}_${Date.now().toString(36)}`;
    return res.status(200).json({ url: `${origin}/?cs=${id}#/welcome`, mock: true });
  }
  const coupon = S.couponFor(plan);
  try {
    const session = await S.stripe("checkout/sessions", {
      mode: "subscription",
      line_items: [{ price: S.priceFor(plan), quantity: 1 }],
      discounts: coupon ? [{ coupon }] : undefined,
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

async function upsell(b, origin, email, utm, res) {
  if (!S.upsellsConfigured()) return res.status(503).json({ error: "Add-ons are not set up yet." });
  const item = String(b.item || "");
  if (!S.UPSELL_IDS.includes(item)) return res.status(400).json({ error: "Unknown add-on" });
  const skip = b.skip === true || b.skip === "1";
  if (S.mockOn()) {
    const id = `mock_upsell_${item}${skip ? "_skip" : ""}_${Date.now().toString(36)}`;
    return res.status(200).json({ url: `${origin}/?cs=${id}#/welcome`, mock: true });
  }
  // Reuse her Stripe customer only when the signed token proves this browser is the buyer (same check as the portal).
  const customer = /^cus_[A-Za-z0-9]+$/.test(String(b.customer || "")) && S.checkSign(b.customer, b.token) ? String(b.customer) : undefined;
  const meta = { kind: "upsell", item, skip: skip ? "1" : "0", ...utm };
  try {
    const session = await S.stripe("checkout/sessions", {
      mode: "payment",
      line_items: [{ price: S.upsellPrice(item, skip), quantity: 1 }],
      customer,
      customer_email: customer ? undefined : email,
      customer_creation: customer ? undefined : "always",
      success_url: `${origin}/?cs={CHECKOUT_SESSION_ID}#/welcome`,
      cancel_url: `${origin}/#/up/${item}`,
      metadata: meta,
      payment_intent_data: { metadata: meta },
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
