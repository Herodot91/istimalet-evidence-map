#!/usr/bin/env node
/**
 * validate-story.js — checks a narrative event record before it is allowed
 * onto the map.
 *
 * The storytelling layer is where unsupported claims get back in. Every
 * other record in this project carries a certainty; `hook`, `story` and
 * `keyTakeaway` do not, and plain-English prose is exactly the register
 * in which "the Ottomans accommodated the locals" reads as settled fact.
 * This validator exists to stop that.
 *
 *   node validate-story.js story.json
 *   node validate-story.js            # runs the built-in fixture
 */

const Y0 = 1450;
const M = (y, m) => (y - Y0) * 12 + (m - 1);

/** The map's own window and projection, so a record can be checked
 *  against them rather than against nothing. */
const WINDOW   = { from: 1450, to: 1600 };
const LON_RANGE = [22.5, 36.5];
const LAT_RANGE = [43.2, 49.6];

/** Vocabularies that already exist. A new one fragments the index. */
const DIMENSIONS = ["COERCION","ADMIN_INTEGRATION","ECONOMIC_INTEGRATION",
  "SECURITY_PROTECTION","LEGAL_CONTINUITY","FISCAL_MODERATION",
  "LOCAL_INCLUSION","RELIGIOUS_ACCOMMODATION"];
const CERTAINTY = ["attested","reconstructed","conjectural"];

/** Claims the corpus does not support. If plain-English prose asserts one
 *  of these without a hedge, it is stating as fact the very thing this
 *  project set out to test. */
/* Written verb-form agnostic on purpose. The first draft of this list
   matched only "kept their courts" and "lower taxes", and sailed straight
   past "let local merchants keep their courts and lowered their taxes" —
   which is exactly how someone writing at a middle-school reading level
   would put it. A guard that only catches the formal phrasing catches
   nothing, because nobody writes the formal phrasing in a story field. */
const UNSUPPORTED = [
  { re:/\b(accommodat\w+|toleran\w+|protect\w+\s+(the\s+)?locals?)\b/i,
    why:"accommodation is untested at both ports — 5 of 8 dimensions have no local evidence" },
  { re:/\b(lower\w*|reduc\w+|cut|eas\w+)\s+(the\s+|their\s+)?tax\w*\b|\btax\w*\s+(relief|break|cut)\b|\bfiscal moderation\b/i,
    why:"fiscal moderation is untested; no kanunname for these ports has been produced" },
  { re:/\b(keep|kept|keeping|retain\w*|k[ei]pt)\s+(on\s+)?(their|its|the)?\s*(own\s+)?(law|court|custom|judge|cadi)\w*\b|\blegal continuity\b/i,
    why:"legal continuity is untested in this corpus" },
  { re:/\b(freedom of worship|religious\s+(freedom|liberty|toleran\w+)|worship\w*\s+freely|kept\s+(their\s+)?(church|faith)\w*)\b/i,
    why:"contradicted at Akkerman — churches converted to mosques (Aşıkpaşazâde)" },
  { re:/\bistim[aâ]let\b/i,
    why:"naming the policy asserts it applied here; that is the open question" }
];
/** A hedge turns an assertion into a proposition, which is allowed. */
const HEDGE = /\b(may|might|could|perhaps|probably|possibly|appears?|seems?|suggest\w*|if |whether|claim\w*|argu\w*|unclear|unknown|not (yet )?(proven|shown|attested)|no evidence)\b/i;

/* ------------------------------------------------------------------ */
function validate(rec){
  const out = [];
  const err  = (c, m, f) => out.push({ level:"error",   code:c, msg:m, fix:f });
  const warn = (c, m, f) => out.push({ level:"warning", code:c, msg:m, fix:f });
  const ok   = (c, m)    => out.push({ level:"ok",      code:c, msg:m });

  /* --- time -------------------------------------------------------- */
  const ie = rec.interactiveElements || {};
  const y = ie.timelineYear;
  if (typeof y === "number"){
    if (y < WINDOW.from || y > WINDOW.to){
      err("YEAR_OUTSIDE_WINDOW",
        `timelineYear ${y} is outside the map's window ${WINDOW.from}–${WINDOW.to} ` +
        `(by ${y > WINDOW.to ? y - WINDOW.to : WINDOW.from - y} years). The event cannot ` +
        `be reached by the time cursor, so the card would be permanently unreachable.`,
        `Either widen the window or place the event in a later map.`);
    } else ok("YEAR_IN_WINDOW", `timelineYear ${y} is reachable`);
    err("YEAR_GRANULAR",
      `timelineYear is a year. Chilia fell in month 7 of 1484 and Akkerman in month 8; ` +
      `at year granularity the two collapse into one instant.`,
      `timelineMonth: "1484-08" — the dataset indexes by month.`);
  } else err("NO_TIME", "no timelineYear", `timelineMonth: "YYYY-MM"`);

  /* --- place ------------------------------------------------------- */
  const c = rec.coordinates;
  if (Array.isArray(c)){
    const [lon, lat, elev] = c;
    if (typeof lon === "number"){
      if (lon < LON_RANGE[0] || lon > LON_RANGE[1] || lat < LAT_RANGE[0] || lat > LAT_RANGE[1])
        warn("OUTSIDE_EXTENT", `(${lon}, ${lat}) falls outside the drawn extent.`);
      else ok("IN_EXTENT", "coordinates inside the map extent");
    }
    if (c.length === 3){
      err("ELEVATION_COLLIDES",
        `The third coordinate is elevation, but the vertical axis on this map is already ` +
        `spoken for: height encodes evidence strength. A column rising 54 units means ` +
        `"directly attested", not "54 metres". Supplying elevation puts two different ` +
        `quantities on one axis.` +
        (typeof elev === "number"
          ? ` There is also no elevation source in this dataset.` : ``),
        `coordinates: [lon, lat] — and if terrain is wanted, it needs its own axis or a ` +
        `separate basemap layer.`);
    }
  } else err("NO_COORDINATES", "no coordinates");

  /* --- camera ------------------------------------------------------ */
  const cam = rec.camera || {};
  if (typeof cam.zoom === "number" && cam.zoom >= 13){
    warn("FALSE_PRECISION_ZOOM",
      `zoom ${cam.zoom} is street level. This dataset's own caveats say fortress ` +
      `coordinates are modern and medieval sites may differ by a few hundred metres. ` +
      `Flying the camera that close asserts a precision the coordinates do not have.`,
      `zoom ≤ 11, or carry a positional uncertainty radius and draw it.`);
  } else if (cam.zoom !== undefined) ok("ZOOM_OK", `zoom ${cam.zoom}`);

  /* --- narrative --------------------------------------------------- */
  const prose = [["hook", rec.hook], ["story", rec.story],
                 ["keyTakeaway", ie.keyTakeaway]].filter(([, v]) => typeof v === "string");
  if (!rec.certainty && !rec.claims){
    err("NARRATIVE_UNGRADED",
      `hook, story and keyTakeaway carry no certainty. Plain English is the register in ` +
      `which an untested claim reads as settled fact — this is the one field in the ` +
      `project where hedging can vanish without anything erroring.`,
      `claims: [{ text, certainty, source }] — grade each assertion, not the card.`);
  } else ok("NARRATIVE_GRADED", "narrative carries certainty");

  for (const [field, text] of prose){
    for (const u of UNSUPPORTED){
      if (u.re.test(text) && !HEDGE.test(text))
        err("UNSUPPORTED_CLAIM",
          `${field} asserts something the corpus does not support: ${u.why}.`,
          `Hedge it, or attach a source that attests it.`);
    }
  }

  /* --- images ------------------------------------------------------- */
  if ("beforeAfterImage" in ie){
    warn("NO_BEFORE_IMAGE",
      `There is no "before" image for 1484. Anything supplied is a modern photograph of ` +
      `the ruins or an artist's reconstruction, and a before/after frame presents it as ` +
      `documentary.`,
      `image: { url, kind: "modern-photo" | "reconstruction", credit } — and label it in ` +
      `the UI, not just the data.`);
  }

  /* --- vocabulary ---------------------------------------------------- */
  if (ie.category){
    warn("PARALLEL_VOCABULARY",
      `category "${ie.category}" is a fourth vocabulary, after the eight dimensions, ` +
      `the render layers and themes.`,
      `dimensions: [${DIMENSIONS[0]}, …] — derive the display category from those.`);
  }

  /* --- sources -------------------------------------------------------- */
  if (!rec.sources) err("NO_SOURCES", "no sources", `sources: ["beldiceanu1964"]`);
  else ok("SOURCES_PRESENT", `${rec.sources.length} source(s)`);

  return out;
}

const FIXTURE = {
  id:"event_01",
  title:"Clear, Jargon-Free Title",
  hook:"One sentence explaining why this mattered to ordinary people",
  story:"2-3 short paragraphs in plain English (middle school reading level)",
  coordinates:[30.35, 46.19, 0],
  camera:{ pitch:-35, bearing:45, zoom:14.5 },
  interactiveElements:{
    timelineYear:1812,
    category:"Battle / Culture / Daily Life",
    beforeAfterImage:"optional_url",
    keyTakeaway:"TL;DR takeaway"
  }
};

function report(rec){
  const res = validate(rec);
  const sym = { error:"x", warning:"!", ok:"+" };
  console.log(`\n${rec.id}\n${"-".repeat(Math.max(rec.id.length, 8))}`);
  for (const r of res){
    console.log(`${sym[r.level]} ${r.code}`);
    if (r.level !== "ok"){
      console.log(`  ${r.msg}`);
      if (r.fix) console.log(`  -> ${r.fix}`);
    }
  }
  const e = res.filter(r => r.level === "error").length;
  const w = res.filter(r => r.level === "warning").length;
  console.log(`\n${e} error(s), ${w} warning(s)`);
  return e;
}

if (typeof require !== "undefined" && require.main === module){
  const f = process.argv[2];
  const rec = f ? JSON.parse(require("fs").readFileSync(f, "utf8")) : FIXTURE;
  process.exit(report(rec) ? 1 : 0);
}
if (typeof module !== "undefined") module.exports = { validate, FIXTURE, UNSUPPORTED, HEDGE };
