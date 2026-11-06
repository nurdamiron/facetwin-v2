import { connect } from "framer-api";
import fs from "node:fs";
const urls = JSON.parse(fs.readFileSync("icon-urls.json", "utf8"));
const framer = await connect("https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
try {
  const inst = (await framer.getNodesWithType("ComponentInstanceNode")).filter((i) => /^Problem card \d+$/.test(i.name));
  inst.sort((a, b) => parseInt(a.name.split(" ").pop()) - parseInt(b.name.split(" ").pop()));
  const dsl = inst.map((n, i) => `SET ${n.id} $control__iconImage="${urls[String(i + 1).padStart(2, "0")]}";`).join("\n");
  const r = await framer.agent.applyChanges(dsl, { pagePath: "/" });
  console.log("RESULT:", JSON.stringify(r).slice(0, 900));
  // read back what each card now holds
  for (const n of inst) { const g = await framer.getNode(n.id); console.log(n.name.padEnd(15), String(g.controls.miIvBHBJc).padEnd(20), JSON.stringify(Object.fromEntries(Object.entries(g.controls).filter(([k]) => k !== "miIvBHBJc"))).slice(0, 150)); }
} catch (e) { console.log("ERR", e.message.split("\n")[0]); } finally { await framer.disconnect(); }
