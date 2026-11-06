import { connect } from "framer-api";
const SCRIPT = `<script>
/* facetwin: pass the ad's UTM and fbclid to the app (the links in Framer stay the plain https://facetwin-demo.vercel.app/; this adds utm_source=framer, utm_medium=landing and the ad params at click time), mark the visit as coming from the landing */
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("a[href^='https://facetwin-demo.vercel.app']"); if (!a) return;
  if (/\/(privacy|terms)\.html/.test(a.pathname)) return; // legal pages stay clean
  try {
    var u = new URL(a.href);
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "framer");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "landing");
    new URLSearchParams(location.search).forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
    u.searchParams.set("from", "lp"); a.href = u.toString();
  } catch (err) {}
}, true);
</script>`;
const framer = await connect(process.env.FRAMER_PROJECT || "https://framer.com/projects/Sensoria-Template-Luna-UI-copy--DOwz3irvvOVivUqlhoe2-31Z3Y");
try {
  const before = await framer.getCustomCode(); console.log("bodyEnd before:", before.bodyEnd && before.bodyEnd.html ? "has code" : "empty");
  if (before.bodyEnd && before.bodyEnd.html && !/facetwin: pass the ad/.test(before.bodyEnd.html)) throw new Error("bodyEnd already has someone else's code, not overwriting");
  await framer.setCustomCode({ html: SCRIPT, location: "bodyEnd" });
  const after = await framer.getCustomCode(); console.log("bodyEnd after:", after.bodyEnd.html ? after.bodyEnd.html.length + " chars, disabled=" + after.bodyEnd.disabled : "empty");
} finally { await framer.disconnect(); }
