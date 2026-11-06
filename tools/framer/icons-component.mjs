import { connect } from "framer-api";
import fs from "node:fs";
const urls = JSON.parse(fs.readFileSync("icon-urls.json", "utf8"));
const framer = await connect("https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
const show = (o) => JSON.stringify(o, null, 1);
try {
  const dsl = [
    `+Variable iconimg name="Icon image" type="image" scope="Cm0k_IQgK" initialValue="${urls["01"]}";`,
    `+FrameNode iconchip parent="deCVPYEF2" index="0" name="Icon chip" layout="stack" stackDirection="vertical" stackDistribution="center" stackAlignment="center" position="relative" width="44px" height="44px" radius="22px" fill="#1E1B2E" overflow="hidden";`,
    `+FrameNode iconpic parent="iconchip" name="Icon" position="relative" width="24px" height="24px" fill="var(--variable-iconimg)";`,
    `DEL GgQDZxRMt;`,
  ].join("\n");
  const r = await framer.agent.applyChanges(dsl, { pagePath: "/" });
  console.log("RESULT:", show(r).slice(0, 1800));
} catch (e) { console.log("ERR", e.message.split("\n")[0]); } finally { await framer.disconnect(); }
