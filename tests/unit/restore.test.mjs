import test from "node:test";
import assert from "node:assert/strict";
import { fresh, mkReq, mkRes, withEnv, withFetch, STRIPE_ENV } from "./helpers.mjs";
import * as S from "../../api/_stripe.js";

const post = (body, headers) => mkReq({ body, headers });
const run = async (h, req) => { const res = mkRes(); await h.default(req, res); return res; };
const REAL = { ...STRIPE_ENV, RESEND_API_KEY: "re_test", MAIL_FROM: "FaceTwin <hello@example.test>" };

// A fake Stripe + Resend: one customer who has an active quarterly plan and a paid Looks add-on.
const stripeAndMail = (opts = {}) => (call) => {
  const u = call.url;
  if (u.startsWith("https://api.resend.com/emails")) return { json: { id: "m1" } };
  if (u.includes("/v1/customers?")) return { json: { data: opts.none ? [] : [{ id: "cus_1" }] } };
  if (u.includes("/v1/subscriptions?")) return { json: { data: [{ status: "active", items: { data: [{ price: { id: "price_gq" } }] } }, { status: "canceled", items: { data: [{ price: { id: "price_gm" } }] } }] } };
  if (u.includes("/v1/checkout/sessions?")) return { json: { data: [{ status: "complete", payment_status: "paid", metadata: { kind: "upsell", item: "looks" } }, { status: "open", payment_status: "unpaid", metadata: { kind: "upsell", item: "coach" } }] } };
  return { status: 404, json: {} };
};
const codeFromMail = (calls) => { const m = calls.find((c) => c.url.includes("resend.com")); return m && /code is (\d{6})/.exec(JSON.parse(m.body).text)[1]; };

test("restore: the code is emailed, then it brings back exactly what Stripe says was paid", async () => {
  await withEnv(REAL, async () => {
    const h = await fresh("../../api/restore.js");
    await withFetch(stripeAndMail(), async (calls) => {
      const sent = await run(h, post({ action: "send", email: "Anna@Example.com" }));
      assert.deepEqual(sent.body, { ok: true });
      const code = codeFromMail(calls); assert.match(code, /^\d{6}$/);
      assert.doesNotMatch(JSON.stringify(sent.body), new RegExp(code), "the code is never in the HTTP answer");
      const mail = JSON.parse(calls.find((c) => c.url.includes("resend.com")).body);
      assert.deepEqual(mail.to, ["Anna@Example.com"]); assert.equal(mail.from, "FaceTwin <hello@example.test>");
      assert.equal(calls.find((c) => c.url.includes("resend.com")).headers.Authorization, "Bearer re_test");

      assert.equal((await run(h, post({ action: "verify", email: "Anna@Example.com", code: "000000" }))).statusCode, 403, "a wrong code");
      const ok = await run(h, post({ action: "verify", email: "anna@example.com", code })); // the email is matched case-insensitively
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.body.plan, "glow_q", "the cancelled monthly subscription is ignored");
      assert.deepEqual(ok.body.owned, { looks: 1 }, "the unpaid Coach session is ignored");
      assert.equal(ok.body.customer, "cus_1");
      assert.ok(S.checkSign("cus_1", ok.body.token), "the portal token is valid");
    });
  });
});

test("restore: an email that is not a customer gets the same answer but no mail and no access", async () => {
  await withEnv(REAL, async () => {
    const h = await fresh("../../api/restore.js");
    await withFetch(stripeAndMail({ none: true }), async (calls) => {
      assert.deepEqual((await run(h, post({ action: "send", email: "nobody@example.com" }))).body, { ok: true });
      assert.equal(calls.filter((c) => c.url.includes("resend.com")).length, 0, "no mail is sent to a stranger");
      assert.equal((await run(h, post({ action: "verify", email: "nobody@example.com", code: "123456" }))).statusCode, 403);
    });
  });
});

test("restore: limits, bad input, and 'not set up' are clean", async () => {
  await withEnv(REAL, async () => {
    const h = await fresh("../../api/restore.js");
    await withFetch(stripeAndMail(), async () => {
      assert.equal((await run(h, post({ action: "send", email: "not an email" }))).statusCode, 400);
      assert.equal((await run(h, post({ action: "verify", email: "a@example.com", code: "12" }))).statusCode, 400);
      assert.equal((await run(h, post({ action: "nope", email: "a@example.com" }))).statusCode, 400);
      assert.equal((await run(h, mkReq({ method: "GET" }))).statusCode, 405);
      assert.equal((await run(h, post({ action: "send", email: "a@example.com" }, { origin: "https://evil.example" }))).statusCode, 403);
      for (let i = 0; i < 3; i++) assert.equal((await run(h, post({ action: "send", email: "b@example.com" }))).statusCode, 200);
      assert.equal((await run(h, post({ action: "send", email: "b@example.com" }))).statusCode, 429, "the 4th code in an hour");
      for (let i = 0; i < 6; i++) assert.equal((await run(h, post({ action: "verify", email: "c@example.com", code: "111111" }))).statusCode, 403);
      assert.equal((await run(h, post({ action: "verify", email: "c@example.com", code: "111111" }))).statusCode, 429, "too many wrong codes");
    });
  });
  await withEnv({ ...STRIPE_ENV }, async () => { // no mail provider configured
    const h = await fresh("../../api/restore.js");
    const res = await run(h, post({ action: "send", email: "a@example.com" }));
    assert.equal(res.statusCode, 503); assert.match(res.body.error, /isn't set up/);
  });
});

test("restore: mock mode (tests and previews) uses 000000 and never mails", async () => {
  await withEnv({ STRIPE_MOCK: "1" }, async () => {
    const h = await fresh("../../api/restore.js");
    await withFetch(() => { throw new Error("no network in mock mode"); }, async (calls) => {
      assert.equal((await run(h, post({ action: "send", email: "a@example.com" }))).body.mock, true);
      assert.equal((await run(h, post({ action: "verify", email: "a@example.com", code: "123456" }))).statusCode, 403);
      const ok = await run(h, post({ action: "verify", email: "a@example.com", code: "000000" }));
      assert.equal(ok.body.plan, "glow_q"); assert.deepEqual(ok.body.owned, { looks: 1 });
      assert.equal((await run(h, post({ action: "verify", email: "none@example.com", code: "000000" }))).statusCode, 404);
      assert.equal(calls.length, 0);
    });
  });
  await withEnv({ STRIPE_MOCK: "1", VERCEL_ENV: "production" }, async () => { // the mock is never honoured in production
    const h = await fresh("../../api/restore.js");
    assert.equal((await run(h, post({ action: "send", email: "a@example.com" }))).statusCode, 503);
  });
});

test("/api/status says whether restore is available", async () => {
  for (const [env, want] of [[REAL, true], [STRIPE_ENV, false], [{}, false], [{ STRIPE_MOCK: "1" }, true]]) {
    await withEnv(env, async () => { const h = await fresh("../../api/status.js"); const res = mkRes(); h.default(mkReq({ method: "GET" }), res); assert.equal(res.body.restore, want); });
  }
});
