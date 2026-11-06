// Step 1 of the link audit: serializes every master component and the home page into all-serialized.json and lists the link values.
//   FRAMER_API_KEY=... NODE_USE_ENV_PROXY=1 node link-audit-dump.mjs   (needs listcomponents.json from framer.agent.listComponents())
import { connect } from "framer-api";
import fs from "node:fs";
const framer = await connect("https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
const lc = JSON.parse(fs.readFileSync("listcomponents.json", "utf8"));
const out = {};
try {
  for (const c of lc.project.canvas) {
    try { out[c.displayName + " " + c.id] = await framer.agent.serialize({ id: c.id, depth: 12 }); }
    catch (e) { out[c.displayName + " " + c.id] = "ERR " + e.message.split("\n")[0]; }
  }
  // pages
  for (const p of ["/"]) { try { out["PAGE " + p] = await framer.agent.serialize({ id: "augiA20Il", depth: 14 }); } catch (e) { out["PAGE " + p] = "ERR " + e.message.split("\n")[0]; } }
} finally { await framer.disconnect(); }
fs.writeFileSync("all-serialized.json", JSON.stringify(out));
const text = JSON.stringify(out);
console.log("size", text.length);
const hits = new Map();
for (const m of text.matchAll(/"(link|href|url|[A-Za-z$_]*[Ll]ink[A-Za-z$_]*)":"([^"]{0,200})"/g)) { const k = m[1] + " = " + m[2]; hits.set(k, (hits.get(k) || 0) + 1); }
for (const [k, n] of [...hits].sort()) console.log(String(n).padStart(3), k);
