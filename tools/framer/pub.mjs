import { connect } from "framer-api";
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
try {
  const r = await framer.publish();
  console.log("PUBLISH:", JSON.stringify(r).slice(0, 700));
  console.log("INFO:", JSON.stringify(await framer.getPublishInfo()).slice(0, 700));
} finally { await framer.disconnect(); }
