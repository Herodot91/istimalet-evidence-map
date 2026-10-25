#!/usr/bin/env node
/**
 * validate-entity.js — checks an entity record against the model this
 * project already uses, before it is allowed into data/bayezid-1484/.
 *
 * The point is not schema conformance. It is that several perfectly
 * well-formed records encode claims that contradict the control history,
 * or silently drop a distinction the rest of the dataset depends on.
 * A JSON-schema validator would pass all of them.
 *
 *   node scripts/validate-entity.js entity.json
 *   node scripts/validate-entity.js            # runs the built-in fixtures
 */

/* ------------------------------------------------------------------ *
 *  Reference facts, drawn from data/bayezid-1484/. Kept small on
 *  purpose: these are the things an entity record can contradict.
 * ------------------------------------------------------------------ */
const Y0 = 1450;
const M = (y, m) => (y - Y0) * 12 + (m - 1);

const PLACES = {
  alba:   { canonical:"Cetatea Albă", alt:["Akkerman","Bilhorod","Moncastro"],
            control:[{ from:M(1391,1), who:"mold" }, { from:M(1484,8), who:"ott" },
                     { from:M(1812,5), who:"rus" }] },
  chilia: { canonical:"Chilia", alt:["Kili","Kiliya","Licostomo"],
            control:[{ from:M(1465,1), who:"mold" }, { from:M(1484,7), who:"ott" },
                     { from:M(1812,5), who:"rus" }] },
  tighina:{ canonical:"Tighina", alt:["Bender"],
            control:[{ from:M(1400,1), who:"mold" }, { from:M(1538,9), who:"ott" },
                     { from:M(1812,5), who:"rus" }] }
};

/** Reigns are not place histories. Keeping them here lets the validator
 *  recognise when a record has quietly used one as the other. */
const REIGNS = {
  "bayezid-ii": { name:"Bayezid II", from:1481, to:1512 },
  "mehmed-ii":  { name:"Mehmed II",  from:1451, to:1481 },
  "selim-i":    { name:"Selim I",    from:1512, to:1520 },
  "stefan":     { name:"Ștefan cel Mare", from:1457, to:1504 }
};

/** The istimâlet dimensions are the project's analytic vocabulary. A
 *  record that invents a parallel one fragments the index. */
const DIMENSIONS = ["COERCION","ADMIN_INTEGRATION","ECONOMIC_INTEGRATION",
  "SECURITY_PROTECTION","LEGAL_CONTINUITY","FISCAL_MODERATION",
  "LOCAL_INCLUSION","RELIGIOUS_ACCOMMODATION"];

const RELATION_KINDS = ["heldBy","takenFrom","takenBy","partOf","adjacentTo",
                        "attestedIn","supersededBy"];
const CERTAINTY = ["attested","reconstructed","conjectural"];

/* ------------------------------------------------------------------ */
const yearOf = t => Y0 + Math.floor(t / 12);
const monthOf = t => (t % 12) + 1;

function holderAt(place, t){
  let who = null;
  for (const c of place.control) if (t >= c.from) who = c.who;
  return who;
}

/* ------------------------------------------------------------------ *
 *  Checks
 * ------------------------------------------------------------------ */
function validate(rec){
  const out = [];
  const err  = (code, msg, fix) => out.push({ level:"error",   code, msg, fix });
  const warn = (code, msg, fix) => out.push({ level:"warning", code, msg, fix });
  const ok   = (code, msg)      => out.push({ level:"ok",      code, msg });

  /* --- identity -------------------------------------------------- */
  const yearInId = /-(1[0-9]{3})$/.exec(rec.id || "");
  if (yearInId){
    err("ID_ENCODES_YEAR",
      `id "${rec.id}" pins the entity to ${yearInId[1]}. The same place will ` +
      `recur in 1538 and 1595, producing three ids for one location — and ` +
      `relations pointing at one of them cannot resolve against the others.`,
      `Use a stable id ("alba") and move the date into the period or the view.`);
  } else ok("ID_STABLE", "id carries no year");

  /* --- naming ------------------------------------------------------ */
  const slug = (rec.id || "").replace(/-1[0-9]{3}$/, "");
  const known = Object.entries(PLACES).find(([k, p]) =>
    k === slug || p.canonical === rec.name || p.alt.includes(rec.name));
  if (known){
    const [key, place] = known;
    if (rec.name !== place.canonical)
      warn("NAME_NOT_CANONICAL",
        `"${rec.name}" is an alternate form; the dataset's canonical name is ` +
        `"${place.canonical}".`,
        `name: "${place.canonical}", alt: ["${rec.name}"]`);
    else ok("NAME_CANONICAL", `"${rec.name}" matches the dataset`);
    checkPeriod(rec, place, key, { err, warn, ok });
  } else {
    warn("UNKNOWN_PLACE", `"${rec.name}" is not in the reference set.`,
      `Add it to data/bayezid-1484/places.json first.`);
  }

  /* --- relations --------------------------------------------------- */
  if (Array.isArray(rec.relations)){
    const untyped = rec.relations.filter(r => typeof r === "string");
    if (untyped.length){
      err("RELATIONS_UNTYPED",
        `${untyped.length} relations are bare strings: ${untyped.join(", ")}. ` +
        `These are not the same kind of edge — a former holder, a conqueror ` +
        `and a body of water collapse into one undirected list, so the graph ` +
        `cannot answer "who held this in 1483".`,
        `{ kind: "takenFrom", target: "moldavia", at: "${"1484-08"}" }`);
    }
    const reign = rec.relations.find(r => REIGNS[r]);
    if (reign && Array.isArray(rec.period)) checkReignScope(rec, reign, { warn });
  }

  /* --- themes vs dimensions ---------------------------------------- */
  if (Array.isArray(rec.themes)){
    warn("PARALLEL_VOCABULARY",
      `themes [${rec.themes.join(", ")}] is a third vocabulary alongside the ` +
      `eight istimâlet dimensions and the render layers. "military" already ` +
      `exists in two of them with different meanings.`,
      `Use dimensions: [${DIMENSIONS.slice(0, 2).join(", ")}] and let layers ` +
      `derive from them.`);
  }

  /* --- evidence ------------------------------------------------------ */
  if (!rec.certainty && !rec.evidence){
    err("NO_EVIDENCE_STATUS",
      `The record asserts a period, relations and themes with no certainty ` +
      `and no source. Every other record in this dataset carries one; a map ` +
      `whose subject is evidence status cannot accept a claim without it.`,
      `certainty: "attested", source: "beldiceanu1964"`);
  } else if (rec.certainty && !CERTAINTY.includes(rec.certainty)){
    err("BAD_CERTAINTY", `certainty "${rec.certainty}" is not in the vocabulary.`,
      CERTAINTY.join(" | "));
  } else ok("EVIDENCE_PRESENT", "certainty or evidence present");

  return out;
}

function checkPeriod(rec, place, key, { err, warn, ok }){
  const p = rec.period;
  if (!Array.isArray(p) || p.length !== 2) return;
  const [a, b] = p;

  /* Year granularity — the distinction the whole dataset rests on. */
  if (Number.isInteger(a) && String(a).length === 4){
    const sameYear = Object.entries(PLACES).filter(([k, pl]) =>
      pl.control.some(c => yearOf(c.from) === a && k !== key));
    if (sameYear.length){
      err("YEAR_GRANULAR_PERIOD",
        `period starts at the year ${a}. ${place.canonical} changed hands in ` +
        `month ${monthOf(place.control.find(c => yearOf(c.from) === a).from)} ` +
        `of ${a}, and ${sameYear.map(([k]) => PLACES[k].canonical).join(", ")} ` +
        `changed hands in the same year but a different month. At year ` +
        `granularity those events collapse into one instant.`,
        `period: ["${a}-0${monthOf(place.control.find(c => yearOf(c.from) === a).from)}", …]`);
    } else warn("YEAR_GRANULAR", `period uses year granularity`,
      `Prefer "YYYY-MM"; the dataset indexes by month.`);
  }

  /* Does the stated end match the control history? */
  const endT = M(b, 12);
  const holderAtEnd = holderAt(place, endT);
  const next = place.control.find(c => yearOf(c.from) > b);
  if (next && yearOf(next.from) !== b){
    warn("PERIOD_END_UNEXPLAINED",
      `period ends at ${b}, but ${place.canonical} does not change hands then. ` +
      `It is held by "${holderAtEnd}" from ` +
      `${yearOf(place.control.find(c => c.who === holderAtEnd).from)} until ` +
      `${yearOf(next.from)}. Nothing in the control history marks ${b}.`,
      `Either extend to ${yearOf(next.from)} or say what ${b} scopes.`);
  } else ok("PERIOD_END_MATCHES", `period end ${b} matches a control change`);
}

function checkReignScope(rec, reignId, { warn }){
  const r = REIGNS[reignId];
  const [, end] = rec.period;
  if (end === r.to){
    warn("PERIOD_IS_A_REIGN",
      `period ends exactly at ${r.to}, the end of ${r.name}'s reign. This is ` +
      `a reign-scoped view of a place, not the place's own period — the ` +
      `location existed before and after. Typing it as "location" makes a ` +
      `analytic window look like a fact about the site.`,
      `type: "location-under-reign", scope: { reign: "${reignId}" } — or split ` +
      `into a stable place entity plus a separate period entity.`);
  }
}

/* ------------------------------------------------------------------ *
 *  Runner
 * ------------------------------------------------------------------ */
const FIXTURE = {
  id:"akkerman-1484", type:"location", name:"Akkerman",
  period:[1484, 1512],
  relations:["bayezid-ii","moldavia","black-sea"],
  themes:["military","trade","diplomacy"]
};

function report(rec){
  const res = validate(rec);
  const sym = { error:"✗", warning:"!", ok:"✓" };
  console.log(`\n${rec.id}\n${"─".repeat(Math.max(rec.id.length, 8))}`);
  for (const r of res){
    console.log(`${sym[r.level]} ${r.code}`);
    if (r.level !== "ok"){
      console.log(`  ${r.msg}`);
      if (r.fix) console.log(`  → ${r.fix}`);
    }
  }
  const e = res.filter(r => r.level === "error").length;
  const w = res.filter(r => r.level === "warning").length;
  console.log(`\n${e} error${e === 1 ? "" : "s"}, ${w} warning${w === 1 ? "" : "s"}`);
  return e;
}

if (require.main === module){
  const file = process.argv[2];
  const rec = file ? JSON.parse(require("fs").readFileSync(file, "utf8")) : FIXTURE;
  process.exit(report(rec) ? 1 : 0);
}

module.exports = { validate, PLACES, REIGNS, DIMENSIONS, RELATION_KINDS, M };
