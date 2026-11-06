import { connect } from "framer-api";
const SCRIPT = `<script>
/* facetwin: pass the ad's UTM and fbclid to the app, mark the visit as coming from the landing */
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("a[href*='utm_source=framer']"); if (!a) return;
  try {
    var u = new URL(a.href);
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
