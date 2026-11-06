import { connect } from "framer-api";
const DRY = process.env.DRY === "1";
// Words match what the app really does: its 8 retouches + Studio. Short (2-3 words) because they run in a ticker.
const WORDS = ["Clearer skin", "Fresher eyes", "Brighter smile", "Freckles on or off", "Healthy glow", "Clean backgrounds", "Softer lines", "Same expression", "Still you"];
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
try {
  const inst = (await framer.getNodesWithType("ComponentInstanceNode")).filter((i) => /^Problem card \d+$/.test(i.name));
  inst.sort((a, b) => parseInt(a.name.split(" ").pop()) - parseInt(b.name.split(" ").pop()));
  for (const [i, n] of inst.entries()) {
    const cur = n.controls && n.controls.miIvBHBJc, nw = WORDS[i];
    console.log(`${n.name.padEnd(15)} ${String(cur).padEnd(34)} -> ${nw || "(no new word)"}`);
    if (!DRY && nw && cur !== nw) await n.setAttributes({ controls: { miIvBHBJc: nw } });
  }
  console.log(DRY ? "(DRY RUN)" : "(APPLIED)");
} finally { await framer.disconnect(); }
