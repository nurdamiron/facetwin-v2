import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
async function kids(n) { try { return n.getChildren ? await n.getChildren() : await framer.getChildren(n.id); } catch { return []; } }
try {
  const home = await framer.getNode("augiA20Il");
  const strays = [];
  for (const bp of await kids(home)) for (const k of await kids(bp)) if (k.name === "FAQ Block") strays.push({ id: k.id, bp: bp.name });
  console.log("strays at breakpoint roots:", JSON.stringify(strays));
  for (const s of strays) { try { await framer.removeNodes([s.id]); console.log("removed", s.id, s.bp); } catch (e) { console.log("could not remove", s.id, e.message.split("\n")[0]); } }
} finally { await framer.disconnect(); }
