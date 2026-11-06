import { connect } from "framer-api";
import fs from "node:fs";
const DIR = "/home/user/facetwin-v2/assets/landing-icons/";
const framer = await connect("https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
try {
  const urls = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".svg")).sort()) {
    const a = await framer.uploadImage({ image: { bytes: new Uint8Array(fs.readFileSync(DIR + f)), mimeType: "image/svg+xml" }, name: "facetwin-hugeicon-" + f.replace(".svg", "") });
    urls[f.slice(0, 2)] = a.url; console.log(f, "->", a.url);
  }
  fs.writeFileSync("icon-urls.json", JSON.stringify(urls, null, 1));
} finally { await framer.disconnect(); }
