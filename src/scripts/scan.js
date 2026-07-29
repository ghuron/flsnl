// scan.js — the Azure Waste Scan analyzer. Runs entirely in the browser.
// Loaded on demand. Nothing here makes a network request; files are read
// locally via the File API and the report opens as a PDF in a new tab.
"use strict";

import { buildSampleCSV } from "./sampleData.js";
import { monthLabel } from "./report-data.js";
import { textFor } from "./strings.js";

/* ---------------------------------------------------------------- utilities */

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

// Yield to the event loop. Used both between queued files and, inside parseCSV, every
// few thousand rows of a single large file — the freeze on a multi-hundred-MB export
// comes from the synchronous parse loop, not from reading the file itself.
function nextFrame() { return new Promise(function (r) { setTimeout(r, 0); }); }

var LARGE_FILE_BYTES = 100 * 1024 * 1024;
var PARSE_YIELD_ROWS = 20000;

// Parse an Azure billing amount written in invariant culture, tolerant of the
// odd thousands separator. Returns 0 for blanks/unparseable cells.
function parseNum(raw) {
  if (raw == null) return 0;
  var s = String(raw).trim();
  if (!s) return 0;
  var lastDot = s.lastIndexOf(".");
  var lastComma = s.lastIndexOf(",");
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the separator that appears last is the decimal point.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56 -> 1234.56
    else s = s.replace(/,/g, "");                                        // 1,234.56 -> 1234.56
  } else if (lastComma !== -1) {
    s = s.replace(",", "."); // 1234,56 -> 1234.56 (comma as decimal)
  }
  var n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

// Detect the field delimiter from a bounded prefix of the file. Azure exports are
// comma-delimited, but a CSV re-saved by a Dutch-locale Excel switches to semicolons
// (with a comma decimal separator inside numeric cells — parseNum already tolerates
// that once the cell is correctly isolated by the right delimiter). Counts outside
// quoted spans; a tie keeps the comma default so normal files are unaffected.
function sniffDelimiter(text) {
  var sample = text.slice(0, 4096);
  var inQuotes = false, commas = 0, semicolons = 0;
  for (var i = 0; i < sample.length; i++) {
    var c = sample[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (c === ",") commas++;
      else if (c === ";") semicolons++;
    }
  }
  return semicolons > commas ? ";" : ",";
}

// RFC-4180-ish CSV parser tuned for large files (14 MB+ MCA exports): unquoted
// fields are sliced with indexOf instead of char-by-char concatenation, and
// only quoted fields fall into the slow path. Handles escaped quotes and CRLF.
// Async and yields every PARSE_YIELD_ROWS rows so the tab stays responsive on a
// large single file — onProgress (optional) gets the running row count.
async function parseCSV(text, delim, onProgress) {
  delim = delim || ",";
  var delimCode = delim.charCodeAt(0);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  var rows = [], row = [], i = 0, n = text.length;
  var nextYield = PARSE_YIELD_ROWS; // a plateau, not a per-field trigger: rows.length only
  // advances at row boundaries, so this must fire once per threshold crossing, not once
  // per field of every row sitting on top of an already-crossed multiple.
  // Consume the delimiter after a field; returns new index. Ends the row on EOL.
  function afterField(idx) {
    var c = text[idx];
    if (c === delim) return idx + 1;
    if (c === "\r") { rows.push(row); row = []; return text[idx + 1] === "\n" ? idx + 2 : idx + 1; }
    if (c === "\n") { rows.push(row); row = []; return idx + 1; }
    return idx; // EOF
  }
  while (i < n) {
    if (text[i] === '"') {
      var val = "", j = i + 1;
      for (;;) {
        var q = text.indexOf('"', j);
        if (q === -1) { val += text.slice(j); j = n; break; }
        val += text.slice(j, q);
        if (text[q + 1] === '"') { val += '"'; j = q + 2; } // escaped ""
        else { j = q + 1; break; }
      }
      row.push(val);
      i = afterField(j);
    } else {
      var next = i;
      while (next < n) { var cc = text.charCodeAt(next); if (cc === delimCode || cc === 10 || cc === 13) break; next++; }
      row.push(text.slice(i, next));
      i = afterField(next);
    }
    if (rows.length >= nextYield) {
      nextYield += PARSE_YIELD_ROWS;
      if (onProgress) onProgress(rows.length);
      await nextFrame();
    }
  }
  if (row.length) rows.push(row);
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  return rows;
}

var norm = function (h) { return String(h || "").toLowerCase().replace(/[\s_/()-]/g, ""); };

// Pick the first header whose normalized name matches one of the candidates.
function pickColumn(header, candidates) {
  var normed = header.map(norm);
  for (var c = 0; c < candidates.length; c++) {
    var idx = normed.indexOf(candidates[c]);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Column aliases cover both the legacy Azure usage export and the FOCUS 1.x schema
// Microsoft now offers alongside it (ChargeCategory/PricingCategory/EffectiveCost/
// BilledCost etc.) — see src/docs/OFFERING.md §6 for the full mapping. Legacy names are
// tried first since they're still the more common export today.
function detectColumns(header) {
  return {
    cost: pickColumn(header, ["costinbillingcurrency", "costusd", "cost", "pretaxcost", "extendedcost", "billingcost", "paygtotal", "pretaxcostusd", "amount", "effectivecost", "billedcost"]),
    paygCost: pickColumn(header, ["paygcostinbillingcurrency", "paygcostinusd", "paygprice"]),
    currency: pickColumn(header, ["billingcurrency", "billingcurrencycode", "currency", "currencycode"]),
    category: pickColumn(header, ["metercategory", "consumedservice", "servicename", "servicefamily", "productname", "product", "metersubcategory"]),
    resourceGroup: pickColumn(header, ["resourcegroup", "resourcegroupname"]),
    resource: pickColumn(header, ["resourcename", "resourceid", "instanceid", "instancename"]),
    subscription: pickColumn(header, ["subscriptionname", "subscriptionid", "subscriptionguid"]),
    date: pickColumn(header, ["date", "usagedate", "servicedate", "usagedatetime"]),
    period: pickColumn(header, ["billingperiodstartdate", "billingperiod", "billingperiodstart"]),
    chargeType: pickColumn(header, ["chargetype", "chargecategory"]),
    // Not "pricingcategory" (the FOCUS name): FOCUS's PricingCategory enum uses different
    // values ("Standard"/"Dynamic"/"Committed"/"Other", not "OnDemand"/"Reservation"/"Spot").
    // The on-demand-coverage math below assumes the legacy vocabulary; matching the FOCUS
    // column without also remapping its values would silently misclassify on-demand spend
    // as committed rather than just skipping the signal — verify the values before wiring
    // this up (see src/docs/OFFERING.md §6 FOCUS mapping note).
    pricingModel: pickColumn(header, ["pricingmodel"]),
    reservation: pickColumn(header, ["reservationname", "benefitname"]),
    tags: pickColumn(header, ["tags", "resourcetags"]),
    meterName: pickColumn(header, ["metername", "xskumetername"]),
    meterSubCategory: pickColumn(header, ["metersubcategory"]),
    publisherType: pickColumn(header, ["publishertype"])
  };
}

function lastSegment(v) {
  if (!v) return "";
  var s = String(v);
  var parts = s.split("/");
  return parts[parts.length - 1] || s;
}

// Parse the date formats Azure exports use and return a YYYY-MM month key, or
// "" when unrecognised. Handles MM/DD/YYYY (en export), YYYY-MM-DD and ISO.
function monthKeyOf(raw) {
  var s = String(raw || "").trim();
  if (!s) return "";
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);      // MM/DD/YYYY
  if (m) return m[3] + "-" + ("0" + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})/);                         // YYYY-MM(-DD) / ISO
  if (m) return m[1] + "-" + m[2];
  var d = new Date(s);
  if (!isNaN(d)) return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
  return "";
}

// The single definition of which column carries the usage date. Both the per-file month
// labels and buildModel's month aggregation go through this, so the file list and the report
// cannot disagree about the period — an invariant a duplicated expression could not enforce.
function dateColOf(cols) {
  return cols.date !== -1 ? cols.date : cols.period;
}

// Which months a single parsed file actually covers, oldest first.
function datasetMonths(ds) {
  var dateCol = dateColOf(ds.cols);
  if (dateCol === -1) return [];
  // Skip repeats of the previous cell rather than hashing every distinct value: exports are
  // date-ordered, so this collapses the tens of thousands of rows sharing a date down to one
  // monthKeyOf call each, and costs one string compare when they don't. A hash of distinct
  // raw cells would be faster on unsorted input, but `date` may be a full timestamp
  // (usagedatetime is an accepted column), and an hourly export would then build a
  // row-sized dictionary — the exact case where the tab can least afford it.
  var seen = Object.create(null), last = null;
  for (var r = 0; r < ds.rows.length; r++) {
    var raw = ds.rows[r][dateCol];
    if (!raw || raw === last) continue;
    last = raw;
    var mk = monthKeyOf(raw);
    if (mk) seen[mk] = true;
  }
  return Object.keys(seen).sort();
}

// "mei 2026", "apr 2026 + mei 2026", or a range once it stops being worth spelling out.
// Only used for the per-file "months covered" text in the file list — the report's own
// month labels/ranges go through report-data.js's periodText instead.
function monthsSummary(keys, lang) {
  var S = textFor(lang);
  if (!keys.length) return "";
  if (keys.length === 1) return monthLabel(keys[0], lang);
  if (keys.length === 2) return S.monthsJoinTwo(monthLabel(keys[0], lang), monthLabel(keys[1], lang));
  return S.monthsRange(monthLabel(keys[0], lang), monthLabel(keys[keys.length - 1], lang), keys.length);
}

function norm2(s) { return String(s || "").toLowerCase().replace(/[\s_-]/g, ""); }

/* -------------------------------------------------- workload classification */

// Meter categories whose cost tracks something that is actually running, so it can in
// principle be switched off or scaled down. Weekend-vs-weekday and the schedulable share of
// non-production spend are both measured against this set — storage and networking keep
// costing the same whether anyone is using them, so counting them would flatten the very
// pattern we are looking for. Lowercased; covers both meterCategory names and the coarser
// serviceFamily value ("Compute") for exports whose category column resolves to that.
var COMPUTE_CATEGORIES = {
  "compute": 1, "virtual machines": 1, "virtual machines licenses": 1, "azure container apps": 1,
  "container apps": 1, "azure app service": 1, "app service": 1, "azure kubernetes service": 1,
  "container instances": 1, "functions": 1, "azure functions": 1, "cloud services": 1, "batch": 1
};

// Infrastructure you run yourself, as opposed to a managed service. A high share is the
// classic lift-and-shift fingerprint: paying for machines and plumbing rather than for
// something that scales itself.
var IAAS_CATEGORIES = {
  "virtual machines": 1, "virtual machines licenses": 1, "storage": 1, "virtual network": 1,
  "load balancer": 1, "bandwidth": 1, "ip addresses": 1, "application gateway": 1,
  "vpn gateway": 1, "azure firewall": 1
};

// Model/inference spend specifically — not "anything with a clever name". Azure Cognitive
// Search is a search index and shows up in estates with no AI workload at all, so matching a
// bare "cognitive" would report AI spend that isn't there. "Foundry Models" is where Azure
// bills GPT tokens today, so leaving it out misses the whole category.
var AI_CATEGORY_RE = /openai|foundry|cognitive services|machine learning|azure ai(?! search)|document intelligence|form recognizer/i;
var EGRESS_METER_RE = /data transfer out|egress/i;
var LICENSE_RE = /windows|sql server (licen|edition)/i;
// Load Balancer meters split into the flat "included rules" base fee and actual data-processed
// volume — the base fee bills the same whether the LB carries any traffic or not, so a set of
// LBs whose cost is almost entirely base fee is the signal that they're each running well under
// capacity and worth consolidating (see the lbConsolidation signal in report-data.js).
var LB_DATA_PROCESSED_RE = /data processed/i;
// Azure prefixes the resource group it auto-creates for a Container Apps managed environment
// with "ME_" — one Standard Load Balancer comes bundled per environment, so a set of LBs living
// in these groups are platform-provisioned, not something a customer wired up by hand.
var MANAGED_ENV_RG_RE = /^me_/i;

// Name fragments that mark an environment as non-production. Matched per token against the
// resource name and its resource group, with trailing digits stripped, so "…-stage2" and
// "rg-dev-01" hit while "accounting" or "devices" (whole tokens, not prefixes) do not.
var NONPROD_TOKENS = {
  dev: 1, development: 1, tst: 1, test: 1, testing: 1, acc: 1, acceptance: 1, stag: 1, stage: 1,
  staging: 1, qa: 1, sbx: 1, sandbox: 1, demo: 1, poc: 1, uat: 1, preprod: 1, nonprod: 1
};
function isNonProdName(name, group) {
  var parts = String(name || "").concat("-", String(group || "")).toLowerCase().split(/[-_/.]+/);
  for (var i = 0; i < parts.length; i++) {
    if (NONPROD_TOKENS[parts[i].replace(/\d+$/, "")]) return true;
  }
  return false;
}

// A real Date for the weekday check, in the same formats monthKeyOf accepts.
function dateOf(raw) {
  var s = String(raw || "").trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);      // MM/DD/YYYY
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                 // YYYY-MM-DD / ISO
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(s);
  return isNaN(d) ? null : d;
}

/* ------------------------------------------------------------------- model  */

function buildModel(datasets, lang) {
  var total = 0, rowCount = 0, negatives = 0, creditsTotal = 0, unusedCommitment = 0, purchaseCost = 0;
  var onDemandCost = 0, commitmentCost = 0, coverageKnown = 0;
  var paygSum = 0, paygKnown = 0;
  var untaggedCost = 0, taggedKnownCost = 0;
  var byCategory = new Map();
  var byGroup = new Map();
  var bySubscription = new Map();
  var byMonth = new Map();
  var byMonthCat = new Map(); // monthKey -> Map(category -> cost)
  var byFinding = new Map(); // "subscription|resourceId" -> finding row, for resource ranking
  var byMeter = new Map();   // meterName -> cost. Bounded by distinct meters (hundreds), so the
  var bySubCat = new Map();  // meterSubCategory -> cost. classification regexes below run over
                             // these once at the end instead of once per row.
  var byLB = new Map();      // resourceId -> { resourceGroup, cost, dataProcessedCost }, Load
                             // Balancer resources only, for the consolidation signal.
  var computeByDay = new Map(); // raw date cell -> compute-only cost, for the weekend comparison
  var daysSeen = new Set();     // distinct raw date cells, to tell daily data from monthly
  var marketplaceCost = 0;
  var currencies = new Set();
  var anyCost = false, anyGroup = false, anyResource = false, anySub = false, anyMonth = false, anyCoverage = false, anyTags = false;

  datasets.forEach(function (ds) {
    var cols = ds.cols, rows = ds.rows;
    if (cols.cost === -1) return;
    anyCost = true;
    if (cols.resourceGroup !== -1) anyGroup = true;
    if (cols.resource !== -1) anyResource = true;
    if (cols.subscription !== -1) anySub = true;
    var dateCol = dateColOf(cols);
    if (dateCol !== -1) anyMonth = true;
    if (cols.pricingModel !== -1) anyCoverage = true;
    if (cols.tags !== -1) anyTags = true;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cost = parseNum(row[cols.cost]);
      var charge = cols.chargeType !== -1 ? norm2(row[cols.chargeType]) : "";

      // An upfront reservation/savings-plan purchase is a one-time commitment buy, not usage.
      // Booked into totals it fakes a spend spike in whatever month/category/resource the
      // purchase happened to land in — poisoning trend, riser and coverage signals alike.
      // Tracked separately and kept out of every other aggregate instead.
      if (charge === "purchase") {
        rowCount++;
        purchaseCost += cost;
        continue;
      }

      total += cost;
      rowCount++;
      if (cost < 0) negatives++;

      if (cols.currency !== -1 && row[cols.currency]) currencies.add(String(row[cols.currency]).trim().toUpperCase());

      var isUnused = charge === "unusedreservation" || charge === "unusedsavingsplan";
      if (charge === "refund" || charge === "credit" || charge === "roundingadjustment") creditsTotal += cost;
      if (isUnused) unusedCommitment += cost;

      if (cols.pricingModel !== -1) {
        var pm = norm2(row[cols.pricingModel]);
        if (pm) {
          coverageKnown += cost;
          if (pm === "ondemand" || pm === "spot") onDemandCost += cost;
          else commitmentCost += cost; // reservation / savingsplan
        }
      }
      if (cols.paygCost !== -1) { paygSum += parseNum(row[cols.paygCost]); paygKnown += cost; }

      if (cols.tags !== -1) {
        var tagVal = String(row[cols.tags] || "").trim().toLowerCase();
        taggedKnownCost += cost;
        if (!tagVal || tagVal === "{}" || tagVal === "[]" || tagVal === "null") untaggedCost += cost;
      }

      var cat = cols.category !== -1 ? (String(row[cols.category] || "").trim() || "(onbekend)") : "(alle)";
      byCategory.set(cat, (byCategory.get(cat) || 0) + cost);
      var isCompute = COMPUTE_CATEGORIES[cat.toLowerCase()] === 1;
      var isLB = cat.toLowerCase() === "load balancer";
      var lbDataProcessed = false;

      if (cols.meterName !== -1) {
        var mn = String(row[cols.meterName] || "").trim();
        if (mn) {
          if (isLB) lbDataProcessed = LB_DATA_PROCESSED_RE.test(mn);
          byMeter.set(mn, (byMeter.get(mn) || 0) + cost);
        }
      }
      if (cols.meterSubCategory !== -1) {
        var msc = String(row[cols.meterSubCategory] || "").trim();
        if (msc) bySubCat.set(msc, (bySubCat.get(msc) || 0) + cost);
      }
      if (cols.publisherType !== -1 && norm2(row[cols.publisherType]) === "marketplace") marketplaceCost += cost;

      if (cols.resourceGroup !== -1) {
        var g = String(row[cols.resourceGroup] || "").trim() || "(geen)";
        byGroup.set(g, (byGroup.get(g) || 0) + cost);
      }
      var sub = "(geen)";
      if (cols.subscription !== -1) {
        sub = String(row[cols.subscription] || "").trim() || "(geen)";
        bySubscription.set(sub, (bySubscription.get(sub) || 0) + cost);
      }
      if (cols.resource !== -1) {
        var resourceRaw = String(row[cols.resource] || "").trim();
        var res = lastSegment(resourceRaw) || "(geen)";

        var fkey = sub + "|" + (resourceRaw || res);
        var finding = byFinding.get(fkey);
        if (!finding) {
          finding = {
            resourceId: resourceRaw || res,
            name: res,
            subscription: sub,
            resourceGroup: cols.resourceGroup !== -1 ? (String(row[cols.resourceGroup] || "").trim() || "(geen)") : "",
            category: cat,
            compute: isCompute,
            cost: 0,
            unusedReservationCost: 0,
            days: null // filled below only when the export carries dates
          };
          byFinding.set(fkey, finding);
        }
        finding.cost += cost;
        // A resource billed under several meters can span categories; "does it run" is true
        // if any of them is compute.
        if (isCompute) finding.compute = true;
        if (isUnused) finding.unusedReservationCost += cost;
        if (isLB) {
          var lbKey = resourceRaw || res;
          var lb = byLB.get(lbKey);
          if (!lb) { lb = { resourceGroup: finding.resourceGroup, cost: 0, dataProcessedCost: 0 }; byLB.set(lbKey, lb); }
          lb.cost += cost;
          if (lbDataProcessed) lb.dataProcessedCost += cost;
        }
        if (dateCol !== -1) {
          var dRaw = row[dateCol];
          if (dRaw) {
            if (!finding.days) finding.days = new Set();
            finding.days.add(dRaw);
          }
        }
      }
      if (dateCol !== -1) {
        var rawDate = row[dateCol];
        if (rawDate) {
          daysSeen.add(rawDate);
          if (isCompute) computeByDay.set(rawDate, (computeByDay.get(rawDate) || 0) + cost);
        }
        var mk = monthKeyOf(rawDate);
        if (mk) {
          byMonth.set(mk, (byMonth.get(mk) || 0) + cost);
          var mc = byMonthCat.get(mk);
          if (!mc) { mc = new Map(); byMonthCat.set(mk, mc); }
          mc.set(cat, (mc.get(cat) || 0) + cost);
        }
      }
    }
  });

  function topN(map, n) {
    return Array.from(map.entries())
      .map(function (e) { return { name: e[0], cost: e[1] }; })
      .sort(function (a, b) { return b.cost - a.cost; })
      .slice(0, n);
  }

  var currency = currencies.size === 1 ? Array.from(currencies)[0] : (currencies.size === 0 ? "" : "MIXED");
  var monthKeys = Array.from(byMonth.keys()).sort();
  // Labels are baked in here, in the page's own language: a single scan is only ever
  // rendered (on-screen and in its PDF) in the language it was run in, so there is no reason
  // to defer this to render time and every consumer below can just read .label.
  var months = monthKeys.map(function (k) { return { key: k, label: monthLabel(k, lang), cost: byMonth.get(k) }; });

  // Categories ranked by how much they grew between the last two months, plus any
  // category that has spend this month but had none in the previous one.
  var catMovers = [], newCategories = [];
  if (monthKeys.length >= 2) {
    var prevK = monthKeys[monthKeys.length - 2], lastK = monthKeys[monthKeys.length - 1];
    var prevMap = byMonthCat.get(prevK) || new Map(), lastMap = byMonthCat.get(lastK) || new Map();
    var names = new Set([].concat(Array.from(prevMap.keys()), Array.from(lastMap.keys())));
    names.forEach(function (name) {
      var pv = prevMap.get(name) || 0, lv = lastMap.get(name) || 0, delta = lv - pv;
      catMovers.push({ name: name, prev: pv, last: lv, delta: delta });
      if (pv <= 0 && lv > 0) newCategories.push({ name: name, cost: lv });
    });
    catMovers.sort(function (a, b) { return b.delta - a.delta; });
    newCategories.sort(function (a, b) { return b.cost - a.cost; });
  }

  var findings = Array.from(byFinding.values()).sort(function (a, b) { return b.cost - a.cost; });

  // Resource rankings come from these findings, keyed on the full resource ID — not from a map
  // keyed on the trailing name segment. Azure gives per-environment infrastructure the same
  // name in every environment (nine load balancers all called `capp-svc-lb` in the reference
  // export), so collapsing on the segment invented one top-spending resource that does not
  // exist and overstated concentration by nine points. The resource group only joins the
  // label where a name genuinely repeats, so the common case stays readable.
  var nameCounts = Object.create(null);
  findings.forEach(function (f) { nameCounts[f.name] = (nameCounts[f.name] || 0) + 1; });
  var resourcesRanked = findings.map(function (f) {
    return { name: nameCounts[f.name] > 1 && f.resourceGroup ? f.name + " · " + f.resourceGroup : f.name, cost: f.cost };
  });
  var top5 = findings.slice(0, 5).reduce(function (a, x) { return a + x.cost; }, 0);

  // --- derived workload metrics. All classification runs over the small per-name maps
  // collected above, never per row, so none of this scales with file size.
  function sumMatching(map, re) {
    var s = 0;
    map.forEach(function (c, name) { if (re.test(name)) s += c; });
    return s;
  }
  var computeCost = 0, iaasCost = 0, aiCost = 0;
  byCategory.forEach(function (c, name) {
    var k = name.toLowerCase();
    if (COMPUTE_CATEGORIES[k] === 1) computeCost += c;
    if (IAAS_CATEGORIES[k] === 1) iaasCost += c;
    if (AI_CATEGORY_RE.test(name)) aiCost += c;
  });

  // Egress reads meter names when the export has them (the category is usually the service,
  // not the transfer); a file without a meter column falls back to the Bandwidth category.
  var egressCost = byMeter.size ? sumMatching(byMeter, EGRESS_METER_RE) : (byCategory.get("Bandwidth") || 0);
  var licenseCost = bySubCat.size ? sumMatching(bySubCat, LICENSE_RE) : 0;

  // Load Balancer consolidation candidates: how many distinct LBs, how much of their combined
  // cost is real data-processing volume vs flat base fee, and how many sit in an auto-created
  // Container Apps managed-environment resource group (platform-provisioned, not hand-wired).
  var lbCount = byLB.size, lbCost = 0, lbDataProcessedCost = 0, lbManagedEnvCount = 0;
  byLB.forEach(function (lb) {
    lbCost += lb.cost;
    lbDataProcessedCost += lb.dataProcessedCost;
    if (MANAGED_ENV_RG_RE.test(lb.resourceGroup || "")) lbManagedEnvCount++;
  });

  // Weekend vs weekday, compute only. Needs real daily rows on both sides of the week to mean
  // anything — a monthly summary, or a date column that resolves to the billing period, gives
  // a handful of identical dates and is skipped rather than guessed at.
  var weekdayTotal = 0, weekdayDays = 0, weekendTotal = 0, weekendDays = 0;
  computeByDay.forEach(function (c, raw) {
    var d = dateOf(raw);
    if (!d) return;
    var wd = d.getDay();
    if (wd === 0 || wd === 6) { weekendTotal += c; weekendDays++; } else { weekdayTotal += c; weekdayDays++; }
  });
  var hasDaily = daysSeen.size >= 14 && weekdayDays >= 8 && weekendDays >= 4;
  var weekdayAvg = weekdayDays ? weekdayTotal / weekdayDays : 0;
  var weekendAvg = weekendDays ? weekendTotal / weekendDays : 0;
  var weekendRatio = hasDaily && weekdayAvg > 0 ? weekendAvg / weekdayAvg : null;

  // Non-production names that bill on (nearly) every day in the period. The schedulable
  // subset is the compute part: storage and load balancers attached to a stopped environment
  // keep costing the same, so folding them into an office-hours estimate would overstate it.
  var nonProdCost = 0, nonProdSchedulable = 0, nonProdCount = 0, nonProdExamples = [];
  var alwaysOnFloor = daysSeen.size ? daysSeen.size * 0.9 : 0;
  if (daysSeen.size) {
    findings.forEach(function (f) {
      if (!f.days || f.days.size < alwaysOnFloor) return;
      if (!isNonProdName(f.name, f.resourceGroup)) return;
      nonProdCost += f.cost;
      nonProdCount++;
      if (f.compute) nonProdSchedulable += f.cost;
      if (nonProdExamples.length < 3 && !nonProdExamples.some(function (e) { return e.name === f.name; })) {
        nonProdExamples.push({ name: f.name, cost: f.cost, days: f.days.size });
      }
    });
  }

  return {
    ok: anyCost && rowCount > 0,
    total: total,
    currency: currency,
    currencies: Array.from(currencies),
    rowCount: rowCount,
    negatives: negatives,
    creditsTotal: creditsTotal,
    unusedCommitment: unusedCommitment,
    purchaseCost: purchaseCost,
    categories: topN(byCategory, 12),
    categoryCount: byCategory.size,
    categoryMap: byCategory,
    groups: anyGroup ? topN(byGroup, 10) : [],
    groupCount: byGroup.size,
    groupMap: byGroup,
    resources: anyResource ? resourcesRanked.slice(0, 10) : [],
    resourcesRankedAll: anyResource ? resourcesRanked : [],
    resourceCount: findings.length,
    subscriptions: anySub ? topN(bySubscription, 10) : [],
    subscriptionCount: bySubscription.size,
    subscriptionMap: bySubscription,
    months: months,
    _catMovers: catMovers.slice(0, 5),
    _newCategories: newCategories,
    hasResources: anyResource,
    hasGroups: anyGroup,
    hasSubscriptions: anySub && bySubscription.size > 1,
    hasMonths: anyMonth && months.length > 0,
    hasCoverage: anyCoverage && coverageKnown > 0,
    onDemandShare: coverageKnown > 0 ? onDemandCost / coverageKnown : 0,
    onDemandCost: onDemandCost,
    commitmentCost: commitmentCost,
    paygDelta: paygKnown > 0 ? paygSum - paygKnown : 0,
    concentrationTop5: total > 0 ? top5 / total : 0,
    hasTags: anyTags,
    untaggedCost: untaggedCost,
    untaggedShare: taggedKnownCost > 0 ? untaggedCost / taggedKnownCost : 0,
    // --- workload shape, for the engineering signals
    computeCost: computeCost,
    computeShare: total > 0 ? computeCost / total : 0,
    iaasShare: total > 0 ? iaasCost / total : 0,
    egressCost: egressCost,
    aiCost: aiCost,
    licenseCost: licenseCost,
    marketplaceCost: marketplaceCost,
    lbCount: lbCount,
    lbCost: lbCost,
    lbDataProcessedCost: lbDataProcessedCost,
    lbManagedEnvCount: lbManagedEnvCount,
    dayCount: daysSeen.size,
    hasDaily: hasDaily,
    weekendRatio: weekendRatio,
    weekdayAvg: weekdayAvg,
    weekendAvg: weekendAvg,
    nonProdCost: nonProdCost,
    nonProdSchedulable: nonProdSchedulable,
    nonProdCount: nonProdCount,
    nonProdExamples: nonProdExamples,
    monthsCovered: months.length,
    generatedAt: new Date()
  };
}

/* -------------------------------------------------------------------- init  */

export function init(mount, lang) {
  if (mount.dataset.scanReady) return mount._api;
  mount.dataset.scanReady = "1";
  lang = lang || "nl";
  var S = textFor(lang);

  var dropzone = mount.querySelector("[data-dropzone]");
  var input = mount.querySelector("[data-file-input]");
  var listEl = mount.querySelector("[data-filelist]");
  var analyzeBtn = mount.querySelector("[data-analyze]");
  var statusEl = mount.querySelector("[data-status]");

  // One entry per opened file: { id, file, name, size, state, months, dataset, error,
  // singleColumn }. state is "queued" | "reading" | "ready" | "error", and `files` is the only
  // list — the work queue is just the entries still in a pre-parse state, so removing a file
  // removes it from the queue by construction.
  //
  // Files are parsed as soon as they are opened rather than at analyze time, so the list can
  // show the months each one covers, and the parsed rows are kept so Analyze reuses them
  // instead of reading everything a second time. Peak memory is unchanged (buildModel already
  // held every dataset at once), but they are now held from open until removal rather than
  // for the duration of one analyze.
  var files = [];
  var seq = 0;
  var draining = false;

  // The PDF chunk (jspdf + jspdf-autotable, ~124KB gzip — far above what's reasonable to ship
  // on every page load) is only ever reached via this dynamic import. It carries more state
  // than index.astro's loader for scan.js because callers need the module back, so the
  // in-flight promise has to be shareable — but the `dead` flag exists for the same reason:
  // a failed dynamic import() is cached by the browser as a permanent rejection for that
  // specifier, so retrying it can never succeed and must not refire forever.
  var pdfPending = false, pdfLoaded = false, pdfDead = false, pdfModule = null, pdfLoadPromise = null;
  function loadPdfModule() {
    if (pdfLoaded) return Promise.resolve(pdfModule);
    if (pdfPending) return pdfLoadPromise;
    if (pdfDead) return Promise.reject(new Error("pdf module dead"));
    if (!navigator.onLine) return Promise.reject(new Error("offline"));
    pdfPending = true;
    pdfLoadPromise = import("./pdf/buildReportPDF.js")
      .then(function (mod) { pdfPending = false; pdfLoaded = true; pdfModule = mod; return mod; })
      .catch(function (err) { pdfPending = false; pdfDead = true; throw err; });
    return pdfLoadPromise;
  }
  window.addEventListener("online", function () { loadPdfModule().catch(function () {}); });

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
  }

  // "ready" is only ever set alongside entry.dataset, so callers can rely on it being there.
  function readyFiles() {
    return files.filter(function (f) { return f.state === "ready"; });
  }

  // Read errors are stored as codes, not prose, so the entry stays a data structure and the
  // wording lives here with the rest of the display strings.
  var READ_ERRORS = { "no-rows": S.status.noRows, unreadable: S.status.unreadable };

  // The one place the four display cases are defined. "unknown" is a file that parsed fine but
  // carries no recognisable date column — neither a success worth highlighting nor an error.
  function monthsCell(f) {
    if (f.state === "queued" || f.state === "reading") {
      return { state: "reading", text: f.size >= LARGE_FILE_BYTES ? S.status.readingLarge : S.status.readingPlain };
    }
    if (f.state === "error") return { state: "error", text: READ_ERRORS[f.error] || READ_ERRORS.unreadable };
    if (!f.months.length) return { state: "unknown", text: S.status.noMonthRecognised };
    return { state: "ready", text: monthsSummary(f.months, lang) };
  }

  function refreshList() {
    if (!files.length) { listEl.hidden = true; listEl.innerHTML = ""; analyzeBtn.disabled = true; return; }
    listEl.hidden = false;
    listEl.innerHTML = files.map(function (f) {
      var cell = monthsCell(f);
      return "<li><span class=\"fmeta\">" +
               "<span class=\"fname\">" + esc(f.name) + "</span>" +
               "<span class=\"fmonths\" data-state=\"" + esc(cell.state) + "\">" + esc(cell.text) + "</span>" +
             "</span>" +
             "<span class=\"size\">" + fmtBytes(f.size) +
             " <button type=\"button\" data-remove=\"" + f.id + "\" aria-label=\"" + esc(S.status.removeFile) + "\">&times;</button></span></li>";
    }).join("");
    // Nothing to analyze until at least one file is parsed, and never mid-read.
    analyzeBtn.disabled = draining || !readyFiles().length;
  }

  function addFiles(fileList) {
    var added = 0;
    Array.prototype.forEach.call(fileList, function (f) {
      if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") return;
      // Skip exact duplicates (same name + size).
      if (files.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
      files.push({ id: ++seq, file: f, name: f.name, size: f.size, state: "queued", months: [], dataset: null, error: "", singleColumn: false });
      added++;
    });
    refreshList();
    if (!added) { setStatus(S.status.chooseFiles, true); return; }
    drain();
  }

  // Parse queued files one at a time — these run up to ~14 MB each, so overlapping them
  // would spike memory for no gain.
  async function drain() {
    if (draining) return;
    draining = true;
    refreshList();

    // Pulling from `files` each round means a file removed while queued is simply never
    // picked up; only the mid-read removal below is a real race worth guarding. The state has
    // to leave "queued" before the await, or find() would keep re-picking the in-flight entry.
    var entry;
    while ((entry = files.find(function (f) { return f.state === "queued"; }))) {
      entry.state = "reading";
      setStatus(S.status.reading(entry.name));
      try {
        await nextFrame();
        var text = await readText(entry.file);
        var delim = sniffDelimiter(text);
        var rows = await parseCSV(text, delim, function (n) {
          setStatus(S.status.readingProgress(entry.name, n));
        });
        text = null; // release the raw string before parsing the next file
        if (files.indexOf(entry) === -1) continue; // removed while it was being read
        entry.singleColumn = rows.length > 0 && rows[0].length <= 1;
        if (rows.length < 2) {
          entry.state = "error";
          entry.error = "no-rows";
        } else {
          entry.dataset = { cols: detectColumns(rows[0]), rows: rows.slice(1) };
          entry.months = datasetMonths(entry.dataset);
          entry.state = "ready";
        }
      } catch (err) {
        entry.state = "error";
        entry.error = "unreadable";
        if (window.console) console.error("read failed", entry.name, err);
      }
      refreshList();
    }

    draining = false;
    refreshList();
    var ready = readyFiles().length;
    setStatus(ready ? S.status.filesReadyToAnalyze(ready) : S.status.noUsableFiles, !ready);
  }

  // --- file input / dropzone wiring ---
  dropzone.addEventListener("click", function () { input.click(); });
  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });
  input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });

  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); if (ev === "dragleave" && e.target !== dropzone) return; dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  listEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-remove]");
    if (!btn) return;
    // Match on a stable id, not a list index: entries can be parsed out from under the
    // rendered order while a read is still in flight.
    var id = parseInt(btn.getAttribute("data-remove"), 10);
    for (var i = 0; i < files.length; i++) {
      if (files[i].id === id) { files.splice(i, 1); break; }
    }
    refreshList();
    var ready = readyFiles().length;
    setStatus(files.length ? S.status.filesReady(ready) : "");
  });

  // --- analyze ---
  function readText(file) {
    if (file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsText(file);
    });
  }

  // Shared by the real Produce-report click and the sample-report click below, so the
  // analyze -> build PDF -> open tab logic exists exactly once. `win` is a tab already opened
  // by window.open() in the click handler itself, before any await ran — opening it here
  // instead would get blocked as a popup by most browsers, since by the time this async
  // function reaches its first await it's no longer considered to be running synchronously
  // inside the click that triggered it. This just navigates that tab to the finished PDF once
  // it's ready — there is no on-screen report and nothing is downloaded, only opened.
  async function produceReport(datasets, fileNames, isSample, win) {
    analyzeBtn.disabled = true;
    function closeWin() { if (win && !win.closed) win.close(); }

    try {
      if (!datasets.length) { setStatus(S.status.noUsableRows, true); closeWin(); return; }
      if (!datasets.some(function (d) { return d.cols.cost !== -1; })) {
        var delimIssue = !isSample && readyFiles().some(function (f) { return f.singleColumn; });
        setStatus(delimIssue ? S.status.noCostColumnDelim : S.status.noCostColumn, true);
        closeWin();
        return;
      }

      setStatus(isSample ? S.status.analyzingSample : S.status.analyzing);
      await nextFrame();
      var model = buildModel(datasets, lang);
      if (!model.ok) { setStatus(S.status.noCostRows, true); closeWin(); return; }

      setStatus(S.status.generatingPdf);
      var mod = await loadPdfModule();
      var blob = await mod.buildReportPDF(model, fileNames, isSample, lang);
      var url = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        // The pre-opened tab got closed (or never opened — some browsers hand back null even
        // for a synchronous window.open) — best-effort retry, though this one, not being
        // synchronous with the original click, may itself get blocked.
        win = window.open(url, "_blank");
        if (!win) { setStatus(S.status.popupBlocked, true); return; }
      }
      setStatus(isSample ? S.status.sampleDone(model.rowCount, fileNames.length) : S.status.analysisDone(model.rowCount, fileNames.length));
    } catch (err) {
      if (window.console) console.error(err);
      closeWin();
      setStatus(pdfDead || !navigator.onLine ? S.status.pdfModuleFailed : (isSample ? S.status.sampleReportError : S.status.pdfError), true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  analyzeBtn.addEventListener("click", function () {
    var ready = readyFiles();
    if (!ready.length) return;
    // Must open synchronously, right here in the click handler — see produceReport's comment.
    var win = window.open("", "_blank");
    // Already parsed when the files were opened — nothing is read twice.
    produceReport(ready.map(function (f) { return f.dataset; }), ready.map(function (f) { return f.name; }), false, win);
  });

  // Zero-effort preview, no file needed. No longer a button inside this mount — called from
  // the hero's sample-report link instead (see AzurePage.astro), exposed on the object init()
  // returns so that link works whether scan.js is already loaded or not.
  async function viewSample(win) {
    try {
      var rows = await parseCSV(buildSampleCSV(), ",");
      var dataset = { cols: detectColumns(rows[0]), rows: rows.slice(1) };
      await produceReport([dataset], [S.sample.sourceLabel], true, win);
    } catch (err) {
      if (window.console) console.error(err);
      if (win && !win.closed) win.close();
      setStatus(S.status.sampleReportError, true);
    }
  }

  var api = { viewSample: viewSample };
  mount._api = api;
  return api;
}
