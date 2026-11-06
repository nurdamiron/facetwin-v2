import { connect } from "framer-api";
const APP = process.env.APP_URL || "https://facetwin-git-claude-trustin-15191a-nurdaulet-akhmatovs-projects.vercel.app/?utm_source=framer&utm_medium=landing";
const CARDS = [
  { fc0xWhwjw: "$9.99", HuTeItTSZ: "first month", Wlwq_6h4L: "Glow monthly", r8Ufyvcw8: "Then $19.99 a month. Unlimited natural retouch and Studio backgrounds. Cancel anytime.",
    vH1rp7rmx: "Unlimited retouch edits", VFHbVjWvS: "Studio backgrounds, passport style", zj2xOy3vG: "HD download, no watermark", CYHQ6Ve7Y: "2 free edits before you pay", PAOmEaTvX: "Cancel anytime in Settings", DXvdqpf1i: "Try it free" },
  { fc0xWhwjw: "$22.49", HuTeItTSZ: "first quarter", Wlwq_6h4L: "Glow quarterly", r8Ufyvcw8: "Then $44.99 every 3 months, that is $15.00 a month. Same Glow plan, 25% cheaper per month.",
    vH1rp7rmx: "Unlimited retouch edits", VFHbVjWvS: "Studio backgrounds, passport style", CYHQ6Ve7Y: "Best value: $15.00 a month", zj2xOy3vG: "HD download, no watermark", PAOmEaTvX: "Cancel anytime in Settings", DXvdqpf1i: "Try it free" },
];
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
async function all(n, pred, out = []) { if (pred(n)) out.push(n); for (const k of await kids(n)) await all(k, pred, out); return out; }
const say = (...a) => console.log(...a);
try {
  const comps = await framer.getNodesWithType("ComponentNode"); const pt = comps.find((c) => c.name === "Pricing Table");
  const inst = await framer.getNode("jkwRGu4DI"); if (!inst || inst.name !== "Pricing Table") throw new Error("original Pricing Table instance not found (already replaced?)");
  const parent = await framer.getParent(inst.id); const index = (await kids(parent)).findIndex((s) => s.id === inst.id);
  say("original at", parent.name, "index", index);
  const copy = await framer.addDetachedComponentLayers({ url: pt.insertURL, layout: true }); say("detached copy", copy.id);
  const drop = await all(copy, (n) => n.__class === "FrameNode" && (n.name === "Top" || n.name === "Custom Plan"));
  if (drop.length) { await framer.removeNodes(drop.map((d) => d.id)); say("removed toggle + custom plan frames:", drop.length); }
  const cards = (await all(copy, (n) => n.__class === "ComponentInstanceNode" && n.controls && "fc0xWhwjw" in n.controls));
  say("cards found:", cards.length);
  for (let i = 0; i < cards.length && i < CARDS.length; i++) {
    const upd = { ...CARDS[i] };
    for (const [k, v] of Object.entries(cards[i].controls)) if (k !== "HuTeItTSZ" && typeof v === "string" && /^https?:/.test(v)) upd[k] = APP; // never touch the price suffix key
    await cards[i].setAttributes({ controls: upd }); say("card", i, "->", upd.Wlwq_6h4L, upd.fc0xWhwjw, "| link keys:", Object.keys(upd).filter((k) => upd[k] === APP).join(",") || "none");
  }
  await framer.setParent(copy.id, parent.id, index); await framer.removeNodes([inst.id]); say("moved into place, original removed");
} catch (e) { say("ERR", e.message.split("\n")[0]); }
finally { await framer.disconnect(); }
