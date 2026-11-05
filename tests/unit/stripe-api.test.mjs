import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../../api/_stripe.js";
import { mkReq, mkRes, withEnv, withFetch, formOf, STRIPE_ENV } from "./helpers.mjs";
import checkout from "../../api/checkout.js";
import verify from "../../api/verify.js";
import status from "../../api/status.js";
import portal from "../../api/portal.js";

const call = async (h, req) => { const res = mkRes(); await h(req, res); return res; };
const co = (body) => call(checkout, mkReq({ body }));
const vf = (cs) => call(verify, mkReq({ method: "GET", url: "/api/verify?cs=" + cs }));
const SESSION = { url: "https://checkout.stripe.test/s/1" };

test("Stripe is 'configured' only with the key and every price; add-ons need their own 4 prices", async () => {
  await withEnv({}, () => { assert.equal(S.configured(), false); assert.equal(S.upsellsConfigured(), false); });
  await withEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_GLOW_M: "a" }, () => assert.equal(S.configured(), false));
  await withEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_GLOW_M: "a", STRIPE_PRICE_GLOW_Q: "b" }, () => { assert.equal(S.configured(), true); assert.equal(S.upsellsConfigured(), false); });
  await withEnv(STRIPE_ENV, () => { assert.equal(S.configured(), true); assert.equal(S.upsellsConfigured(), true); });
});

test("the Stripe mock is honoured locally and on previews, never on the production deployment", async () => {
  await withEnv({ STRIPE_MOCK: "1" }, () => assert.equal(S.mockOn(), true));
  await withEnv({ STRIPE_MOCK: "1", VERCEL_ENV: "preview" }, () => assert.equal(S.mockOn(), true));
  await withEnv({ STRIPE_MOCK: "1", VERCEL_ENV: "production" }, async () => {
    assert.equal(S.mockOn(), false);
    assert.equal((await vf("mock_glow_m_abc")).statusCode, 400, "a mock session can't unlock anything in production");
    assert.equal((await co({ plan: "glow_m" })).statusCode, 503);
  });
  await withEnv({}, () => assert.equal(S.mockOn(), false));
});

test("signed token: roundtrip, tamper and wrong customer are rejected", async () => {
  await withEnv({ STRIPE_SECRET_KEY: "sk_one" }, () => {
    const t = S.sign("cus_123");
    assert.equal(S.checkSign("cus_123", t), true);
    assert.equal(S.checkSign("cus_124", t), false);
    assert.equal(S.checkSign("cus_123", t.slice(0, -2) + "xx"), false);
    assert.equal(S.checkSign("cus_123", ""), false);
    assert.equal(S.checkSign("cus_123", undefined), false);
  });
  const a = await withEnv({ STRIPE_SECRET_KEY: "sk_one" }, () => S.sign("cus_1"));
  const b = await withEnv({ STRIPE_SECRET_KEY: "sk_two" }, () => S.sign("cus_1"));
  assert.notEqual(a, b, "tokens depend on the secret key");
});

test("subscription checkout: right price, mode and first-period coupon per plan", async () => {
  await withEnv(STRIPE_ENV, async () => {
    await withFetch(() => ({ json: SESSION }), async (calls) => {
      assert.deepEqual((await co({ plan: "glow_m", email: "a@b.co", utm: { utm_source: "meta", junk: "x" } })).body, SESSION);
      const m = formOf(calls[0]);
      assert.equal(m.mode, "subscription");
      assert.equal(m["line_items[0][price]"], "price_gm");
      assert.equal(m["discounts[0][coupon]"], "cpn_m");
      assert.equal(m.customer_email, "a@b.co");
      assert.equal(m["metadata[utm_source]"], "meta");
      assert.equal(m["metadata[junk]"], undefined, "only known UTM keys are kept");
      assert.equal(m["subscription_data[metadata][plan]"], "glow_m");
      assert.match(m.success_url, /\?cs=\{CHECKOUT_SESSION_ID\}#\/welcome$/);
      await co({ plan: "glow_q" });
      const q = formOf(calls[1]);
      assert.equal(q["line_items[0][price]"], "price_gq");
      assert.equal(q["discounts[0][coupon]"], "cpn_q");
      assert.equal(calls[0].headers.Authorization, "Bearer sk_test_x");
    });
  });
});

test("subscription checkout rejects unknown plans (including the removed annual and Pro ones)", async () => {
  await withEnv(STRIPE_ENV, async () => {
    for (const plan of ["glow_y", "pro_m", "pro_y", "", "../x", undefined]) assert.equal((await co({ plan })).statusCode, 400, String(plan));
    assert.equal((await call(checkout, mkReq({ method: "GET" }))).statusCode, 405);
  });
  await withEnv({}, async () => assert.equal((await co({ plan: "glow_m" })).statusCode, 503));
});

test("add-on checkout: one-time payment, first or second-chance price, never a subscription", async () => {
  await withEnv(STRIPE_ENV, async () => {
    await withFetch(() => ({ json: SESSION }), async (calls) => {
      await co({ kind: "upsell", item: "looks", email: "a@b.co" });
      const a = formOf(calls[0]);
      assert.equal(a.mode, "payment");
      assert.equal(a["line_items[0][price]"], "price_l");
      assert.equal(a["metadata[kind]"], "upsell"); assert.equal(a["metadata[item]"], "looks"); assert.equal(a["metadata[skip]"], "0");
      assert.equal(a.customer_creation, "always");
      assert.equal(a.customer_email, "a@b.co");
      await co({ kind: "upsell", item: "looks", skip: true });
      assert.equal(formOf(calls[1])["line_items[0][price]"], "price_ls");
      assert.equal(formOf(calls[1])["metadata[skip]"], "1");
      await co({ kind: "upsell", item: "coach" });
      assert.equal(formOf(calls[2])["line_items[0][price]"], "price_c");
      await co({ kind: "upsell", item: "coach", skip: true });
      assert.equal(formOf(calls[3])["line_items[0][price]"], "price_cs");
      assert.equal(formOf(calls[3]).discounts, undefined);
    });
    assert.equal((await co({ kind: "upsell", item: "nope" })).statusCode, 400);
  });
  await withEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_GLOW_M: "a", STRIPE_PRICE_GLOW_Q: "b" }, async () =>
    assert.equal((await co({ kind: "upsell", item: "looks" })).statusCode, 503, "add-ons off until their prices exist"));
});

test("add-on checkout reuses the Stripe customer only with a valid signed token", async () => {
  await withEnv(STRIPE_ENV, async () => {
    const token = S.sign("cus_ABC");
    await withFetch(() => ({ json: SESSION }), async (calls) => {
      await co({ kind: "upsell", item: "looks", customer: "cus_ABC", token, email: "a@b.co" });
      const ok = formOf(calls[0]);
      assert.equal(ok.customer, "cus_ABC"); assert.equal(ok.customer_creation, undefined); assert.equal(ok.customer_email, undefined);
      await co({ kind: "upsell", item: "looks", customer: "cus_ABC", token: "forged", email: "a@b.co" });
      const bad = formOf(calls[1]);
      assert.equal(bad.customer, undefined, "someone else's customer id with a forged token is ignored");
      assert.equal(bad.customer_creation, "always");
      await co({ kind: "upsell", item: "looks", customer: "not-a-customer", token });
      assert.equal(formOf(calls[2]).customer, undefined);
    });
  });
});

test("Stripe errors come back as 502 with the message, not as a crash", async () => {
  await withEnv(STRIPE_ENV, async () => {
    await withFetch(() => ({ status: 400, json: { error: { message: "No such coupon" } } }), async () => {
      const r = await co({ plan: "glow_m" });
      assert.equal(r.statusCode, 502); assert.match(r.body.error, /No such coupon/);
    });
  });
});

test("mock mode: checkout hands back a mock session that verify understands", async () => {
  await withEnv({ STRIPE_MOCK: "1" }, async () => {
    const a = await co({ plan: "glow_q" });
    const cs = new URL(a.body.url).searchParams.get("cs");
    assert.match(cs, /^mock_glow_q_/);
    const v = await vf(cs);
    assert.deepEqual([v.body.paid, v.body.kind, v.body.plan, v.body.tier], [true, "plan", "glow_q", "glow"]);
    const u = await co({ kind: "upsell", item: "coach", skip: true });
    const v2 = await vf(new URL(u.body.url).searchParams.get("cs"));
    assert.deepEqual([v2.body.paid, v2.body.kind, v2.body.item, v2.body.skip], [true, "upsell", "coach", true]);
    const v3 = await vf(new URL((await co({ kind: "upsell", item: "looks" })).body.url).searchParams.get("cs"));
    assert.deepEqual([v3.body.item, v3.body.skip], ["looks", false]);
    assert.equal((await vf("mock_pro_m_abc")).statusCode, 400, "removed plans can't be faked either");
    assert.equal((await vf("mock_upsell_hacks_abc")).statusCode, 400);
  });
});

test("verify trusts Stripe, not the browser", async () => {
  await withEnv(STRIPE_ENV, async () => {
    assert.equal((await vf("junk")).statusCode, 400);
    assert.equal((await vf("mock_glow_m_abc")).statusCode, 400, "mock sessions are off without STRIPE_MOCK");
    const sess = (over) => ({ json: { status: "complete", payment_status: "paid", metadata: { plan: "glow_q" }, amount_total: 2249, currency: "usd", customer: "cus_Z", customer_details: { email: "a@b.co" }, ...over } });
    await withFetch(() => sess({}), async (calls) => {
      const r = await vf("cs_test_abc123");
      assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions/cs_test_abc123");
      assert.deepEqual([r.body.paid, r.body.kind, r.body.plan, r.body.value, r.body.currency, r.body.customer, r.body.email], [true, "plan", "glow_q", 22.49, "USD", "cus_Z", "a@b.co"]);
      assert.equal(S.checkSign("cus_Z", r.body.token), true);
    });
    await withFetch(() => sess({ metadata: { kind: "upsell", item: "looks", skip: "1" }, amount_total: 2399 }), async () => {
      const r = await vf("cs_live_abc");
      assert.deepEqual([r.body.paid, r.body.kind, r.body.item, r.body.skip, r.body.value], [true, "upsell", "looks", true, 23.99]);
    });
    await withFetch(() => sess({ payment_status: "unpaid" }), async () => assert.equal((await vf("cs_test_x")).body.paid, false));
    await withFetch(() => sess({ status: "open" }), async () => assert.equal((await vf("cs_test_x")).body.paid, false));
    await withFetch(() => sess({ metadata: { plan: "pro_y" } }), async () => assert.equal((await vf("cs_test_x")).body.paid, false, "a session for a plan we don't sell grants nothing"));
    await withFetch(() => sess({ metadata: { kind: "upsell", item: "hax" } }), async () => assert.equal((await vf("cs_test_x")).body.paid, false));
    await withFetch(() => sess({ metadata: {} }), async () => assert.equal((await vf("cs_test_x")).body.paid, false));
    await withFetch(() => ({ status: 404, json: { error: { message: "No such session" } } }), async () => assert.equal((await vf("cs_test_x")).statusCode, 502));
  });
});

test("status tells the page what is switched on", async () => {
  await withEnv({}, async () => {
    const r = await call(status, mkReq({ method: "GET" }));
    assert.deepEqual([r.body.ai, r.body.payments, r.body.upsells, r.body.paymentsMock], [false, false, false, false]);
  });
  await withEnv({ ...STRIPE_ENV, GEMINI_API_KEY: "k" }, async () => {
    const r = await call(status, mkReq({ method: "GET" }));
    assert.deepEqual([r.body.ai, r.body.payments, r.body.upsells], [true, true, true]);
  });
  await withEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_GLOW_M: "a", STRIPE_PRICE_GLOW_Q: "b" }, async () => {
    const r = await call(status, mkReq({ method: "GET" }));
    assert.deepEqual([r.body.payments, r.body.upsells], [true, false]);
  });
});

test("billing portal: only the buyer's signed token opens it", async () => {
  await withEnv(STRIPE_ENV, async () => {
    const token = S.sign("cus_P1");
    const p = (body) => call(portal, mkReq({ body }));
    assert.equal((await p({ customer: "cus_P1", token: "forged" })).statusCode, 403);
    assert.equal((await p({ customer: "bad id", token })).statusCode, 403);
    await withFetch(() => ({ json: { url: "https://billing.stripe.test/p" } }), async (calls) => {
      const r = await p({ customer: "cus_P1", token });
      assert.equal(r.body.url, "https://billing.stripe.test/p");
      assert.equal(formOf(calls[0]).customer, "cus_P1");
    });
  });
});
