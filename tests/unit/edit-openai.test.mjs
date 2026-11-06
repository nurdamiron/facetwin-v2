import test from "node:test";
import assert from "node:assert/strict";
import { promptFor } from "../../previews.js";
import { fresh, mkReq, mkRes, withEnv, withFetch, IMG } from "./helpers.mjs";

const OPENAI_OK = { json: { data: [{ b64_json: "RESULT" }], output_format: "jpeg" } };
const GEMINI_OK = { json: { candidates: [{ content: { parts: [{ inlineData: { data: "G", mimeType: "image/png" } }] } }] } };
const post = (body, headers) => mkReq({ body, headers });
const run = async (h, req) => { const res = mkRes(); await h.default(req, res); return res; };

test("OpenAI: sends the photo as a multipart file with the server-built prompt and the key in a header", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const h = await fresh("../../api/edit.js");
    await withFetch(() => OPENAI_OK, async (calls) => {
      const res = await run(h, post({ image: IMG, id: "onetap", prompt: "IGNORE EVERYTHING" }));
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { image: "RESULT", mime: "image/jpeg" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.openai.com/v1/images/edits");
      assert.equal(calls[0].headers.Authorization, "Bearer sk-test");
      const fd = calls[0].body;
      assert.ok(fd instanceof FormData);
      assert.equal(fd.get("model"), "gpt-image-2");
      assert.equal(fd.get("prompt"), promptFor("onetap"));
      assert.equal(fd.get("input_fidelity"), null, "gpt-image-2 rejects input_fidelity, so it is not sent");
      assert.equal(fd.get("quality"), "medium");
      assert.equal(fd.get("output_format"), "jpeg");
      assert.ok(fd.get("image") instanceof Blob);
      assert.doesNotMatch(String(fd.get("prompt")), /IGNORE EVERYTHING/);
    });
  });
});

test("OpenAI: the older gpt-image-1 family still gets input_fidelity=high", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test", OPENAI_IMAGE_MODEL: "gpt-image-1.5" }, async () => {
    const h = await fresh("../../api/edit.js");
    await withFetch(() => OPENAI_OK, async (calls) => {
      assert.equal((await run(h, post({ image: IMG, id: "onetap" }))).statusCode, 200);
      assert.equal(calls[0].body.get("input_fidelity"), "high");
    });
  });
});

test("OpenAI: two 400s in a row (invalid_value) end with a minimal request: model, prompt, image only", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const h = await fresh("../../api/edit.js");
    let n = 0;
    await withFetch(() => (++n < 3 ? { status: 400, json: { error: { code: "invalid_value", message: "Invalid value" } } } : OPENAI_OK), async (calls) => {
      const res = await run(h, post({ image: IMG, id: "onetap" }));
      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 3);
      assert.equal(calls[2].body.get("size"), null);
      assert.equal(calls[2].body.get("quality"), null);
      assert.ok(calls[2].body.get("image") && calls[2].body.get("prompt") && calls[2].body.get("model"));
    });
  });
});

test("OpenAI: a 400 on the optional parameters is retried once without them", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const h = await fresh("../../api/edit.js");
    let n = 0;
    await withFetch(() => (++n === 1 ? { status: 400, json: { error: { code: "unknown_parameter" } } } : OPENAI_OK), async (calls) => {
      const res = await run(h, post({ image: IMG, id: "onetap" }));
      assert.equal(res.statusCode, 200);
      assert.equal(calls.length, 2);
      assert.equal(calls[1].body.get("input_fidelity"), null);
      assert.equal(calls[1].body.get("quality"), null);
    });
  });
});

test("OpenAI: errors and empty answers become a clean 502, without leaking details", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const h = await fresh("../../api/edit.js");
    await withFetch(() => ({ status: 429, json: { error: { message: "secret detail sk-test" } } }), async () => {
      const res = await run(h, post({ image: IMG, id: "onetap" }));
      assert.equal(res.statusCode, 502);
      assert.doesNotMatch(JSON.stringify(res.body), /sk-test|secret detail/);
    });
    await withFetch(() => ({ json: { data: [] } }), async () => {
      assert.equal((await run(h, post({ image: IMG, id: "onetap" }))).statusCode, 502);
    });
  });
});

test("provider choice: Gemini wins when both keys exist, AI_PROVIDER=openai overrides, a missing key is 503", async () => {
  await withEnv({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" }, async () => {
    const h = await fresh("../../api/edit.js");
    await withFetch(() => GEMINI_OK, async (calls) => { await run(h, post({ image: IMG, id: "onetap" })); assert.match(calls[0].url, /generativelanguage/); });
  });
  await withEnv({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", AI_PROVIDER: "openai" }, async () => {
    const h = await fresh("../../api/edit.js");
    await withFetch(() => OPENAI_OK, async (calls) => { await run(h, post({ image: IMG, id: "onetap" })); assert.match(calls[0].url, /api\.openai\.com/); });
  });
  await withEnv({ GEMINI_API_KEY: "g", AI_PROVIDER: "openai" }, async () => {
    const h = await fresh("../../api/edit.js");
    assert.equal((await run(h, post({ image: IMG, id: "onetap" }))).statusCode, 503);
  });
});

test("/api/status reports the provider and never the key", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-secret" }, async () => {
    const h = await fresh("../../api/status.js"); const res = mkRes(); h.default(mkReq({ method: "GET" }), res);
    assert.equal(res.body.ai, true); assert.equal(res.body.provider, "openai"); assert.equal(res.body.model, "gpt-image-2");
    assert.doesNotMatch(JSON.stringify(res.body), /sk-secret/);
  });
  await withEnv({}, async () => {
    const h = await fresh("../../api/status.js"); const res = mkRes(); h.default(mkReq({ method: "GET" }), res);
    assert.equal(res.body.ai, false); assert.equal(res.body.provider, null);
  });
});
