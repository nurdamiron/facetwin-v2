// Example of applying link fixes through framer.agent.applyChanges: SET <id> $control__link="..." for component instances, SET <id> link.href="..." for text and frames.
import { connect } from "framer-api";
import fs from "node:fs";
const framer = await connect("https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
const lines = fs.readFileSync("link-plan.dsl", "utf8").split("\n").filter(Boolean);
lines.push('SET F8aa3xwo1 scrollTargetEnabled="true" elementId="faq";', 'SET ynRMQIqr8F8aa3xwo1 scrollTargetEnabled="true" elementId="faq";', 'SET xz0wMRDwVF8aa3xwo1 scrollTargetEnabled="true" elementId="faq";');
let ok = 0; const fails = [];
try {
  const r = await framer.agent.applyChanges(lines.join("\n"), { pagePath: "/" });
  console.log("BULK:", JSON.stringify(r).slice(0, 600));
} catch (e) {
  console.log("BULK failed:", e.message.split("\n")[0].slice(0, 300), "-> line by line");
  for (const l of lines) { try { await framer.agent.applyChanges(l, { pagePath: "/" }); ok++; } catch (e2) { fails.push(l.slice(0, 70) + " :: " + e2.message.split("\n")[0].slice(0, 120)); } }
  console.log("line by line ok:", ok, "failed:", fails.length); console.log(fails.slice(0, 12).join("\n"));
} finally { await framer.disconnect(); }
