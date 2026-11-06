// Step 2: reads all-serialized.json and prints every link-like string (controls, rich-text links, mailto) with the node ids to fix.
import fs from "node:fs";
const all = JSON.parse(fs.readFileSync("all-serialized.json", "utf8"));
const found = [];
function walk(n, anc, root, key) {
  if (n && typeof n === "object") {
    const id = !Array.isArray(n) && n.id ? n.id : null;
    const a2 = id ? [...anc, { id, name: n.name || n.type }] : anc;
    for (const [k, v] of Object.entries(n)) walk(v, a2, root, k);
  } else if (typeof n === "string" && /(mailto:|https?:\/\/|^\/(#|$)|href=)/.test(n) && n.length < 400 && !/framerusercontent|fonts\.|\.svg|\.png|\.jpg|\.webp|w3\.org|schema/.test(n)) {
    found.push({ root: root.replace(/ \w+$/, ""), key, v: n, node: anc[anc.length - 1] });
  }
}
for (const [root, tree] of Object.entries(all)) walk(tree, [], root, "");
const g = {};
for (const f of found) { const k = `${f.root} | ${f.key} | ${f.v.slice(0, 110)}`; (g[k] ||= new Set()).add(f.node && f.node.id + ":" + f.node.name); }
for (const [k, s] of Object.entries(g).sort()) console.log(String(s.size).padStart(2), k, "|", [...s].slice(0, 2).join(" ; "));
