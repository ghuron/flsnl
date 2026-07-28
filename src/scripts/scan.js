// scan.js — the Azure Waste Scan analyzer. Runs entirely in the browser.
// Loaded on demand. Nothing here makes a network request; files are read
// locally via the File API and the report is saved as a local download.
"use strict";

import { SAMPLE_CSV } from "./sampleData.js";
import { makeMoney, buildSignals, periodText } from "./report-data.js";

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
    tags: pickColumn(header, ["tags", "resourcetags"])
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

var MONTH_NL = ["", "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function monthLabel(key) {
  var p = key.split("-");
  return p.length === 2 ? MONTH_NL[parseInt(p[1], 10)] + " " + p[0] : key;
}
// Which months a single parsed file actually covers, oldest first. The date-column fallback
// mirrors buildModel exactly, so what the file list promises and what the report totals can
// never disagree.
function datasetMonths(ds) {
  var dateCol = ds.cols.date !== -1 ? ds.cols.date : ds.cols.period;
  if (dateCol === -1) return [];
  var seen = Object.create(null);
  for (var r = 0; r < ds.rows.length; r++) {
    var mk = monthKeyOf(ds.rows[r][dateCol]);
    if (mk) seen[mk] = true;
  }
  return Object.keys(seen).sort();
}

// "mei 2026", "apr 2026 + mei 2026", or a range once it stops being worth spelling out.
function monthsSummary(keys) {
  if (!keys.length) return "";
  if (keys.length === 1) return monthLabel(keys[0]);
  if (keys.length === 2) return monthLabel(keys[0]) + " + " + monthLabel(keys[1]);
  return monthLabel(keys[0]) + " – " + monthLabel(keys[keys.length - 1]) + " · " + keys.length + " maanden";
}

function norm2(s) { return String(s || "").toLowerCase().replace(/[\s_-]/g, ""); }

/* ------------------------------------------------------------------- model  */

function buildModel(datasets) {
  var total = 0, rowCount = 0, negatives = 0, creditsTotal = 0, unusedCommitment = 0, purchaseCost = 0;
  var onDemandCost = 0, commitmentCost = 0, coverageKnown = 0;
  var paygSum = 0, paygKnown = 0;
  var untaggedCost = 0, taggedKnownCost = 0;
  var byCategory = new Map();
  var byGroup = new Map();
  var byResource = new Map();
  var bySubscription = new Map();
  var byMonth = new Map();
  var byMonthCat = new Map(); // monthKey -> Map(category -> cost)
  var byFinding = new Map(); // "subscription|resourceId" -> finding row, for the CSV export
  var currencies = new Set();
  var anyCost = false, anyGroup = false, anyResource = false, anySub = false, anyMonth = false, anyCoverage = false, anyTags = false;

  datasets.forEach(function (ds) {
    var cols = ds.cols, rows = ds.rows;
    if (cols.cost === -1) return;
    anyCost = true;
    if (cols.resourceGroup !== -1) anyGroup = true;
    if (cols.resource !== -1) anyResource = true;
    if (cols.subscription !== -1) anySub = true;
    if (cols.date !== -1 || cols.period !== -1) anyMonth = true;
    if (cols.pricingModel !== -1) anyCoverage = true;
    if (cols.tags !== -1) anyTags = true;
    var dateCol = cols.date !== -1 ? cols.date : cols.period;

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
        byResource.set(res, (byResource.get(res) || 0) + cost);

        var fkey = sub + "|" + (resourceRaw || res);
        var finding = byFinding.get(fkey);
        if (!finding) {
          finding = {
            resourceId: resourceRaw || res,
            subscription: sub,
            resourceGroup: cols.resourceGroup !== -1 ? (String(row[cols.resourceGroup] || "").trim() || "(geen)") : "",
            category: cat,
            cost: 0,
            unusedReservationCost: 0
          };
          byFinding.set(fkey, finding);
        }
        finding.cost += cost;
        if (isUnused) finding.unusedReservationCost += cost;
      }
      if (dateCol !== -1) {
        var mk = monthKeyOf(row[dateCol]);
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
  var resourcesSorted = topN(byResource, 1e9);
  var top5 = resourcesSorted.slice(0, 5).reduce(function (a, x) { return a + x.cost; }, 0);
  var monthKeys = Array.from(byMonth.keys()).sort();
  var months = monthKeys.map(function (k) { return { key: k, label: monthLabel(k), cost: byMonth.get(k) }; });

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
    resources: anyResource ? resourcesSorted.slice(0, 10) : [],
    resourceCount: byResource.size,
    subscriptions: anySub ? topN(bySubscription, 10) : [],
    subscriptionCount: bySubscription.size,
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
    resourceFindings: findings,
    hasFindings: findings.length > 0,
    generatedAt: new Date()
  };
}

/* ---------------------------------------------------------------- rendering */

function tableHTML(title, rows, money) {
  if (!rows.length) return "";
  var max = rows[0].cost || 1;
  var body = rows.map(function (r) {
    var pct = Math.max(0, Math.min(100, (r.cost / max) * 100));
    return "<tr><td>" + esc(r.name) + "</td>" +
           "<td class=\"num\">" + esc(money(r.cost)) + "</td>" +
           "<td class=\"bar\"><span style=\"width:" + pct.toFixed(1) + "%\"></span></td></tr>";
  }).join("");
  return "<h3>" + esc(title) + "</h3><div class=\"table-scroll\"><table class=\"result-table\">" +
         "<thead><tr><th>Naam</th><th class=\"num\">Kosten</th><th></th></tr></thead>" +
         "<tbody>" + body + "</tbody></table></div>";
}

// A compact month-over-month bar table.
function monthsTableHTML(m, money) {
  if (!m.hasMonths || m.months.length < 2) return "";
  var max = m.months.reduce(function (a, x) { return Math.max(a, x.cost); }, 1);
  var body = m.months.map(function (r) {
    var pct = Math.max(0, Math.min(100, (r.cost / max) * 100));
    return "<tr><td>" + esc(r.label) + "</td><td class=\"num\">" + esc(money(r.cost)) +
           "</td><td class=\"bar\"><span style=\"width:" + pct.toFixed(1) + "%\"></span></td></tr>";
  }).join("");
  return "<h3>Verloop per maand</h3><div class=\"table-scroll\"><table class=\"result-table\">" +
         "<thead><tr><th>Maand</th><th class=\"num\">Kosten</th><th></th></tr></thead><tbody>" + body + "</tbody></table></div>";
}

function renderResults(container, m, isSample) {
  var money = makeMoney(m.currency === "MIXED" ? "" : m.currency);
  var fourth = m.hasCoverage
    ? kpi(Math.round(m.onDemandShare * 100) + "%", "On-demand")
    : kpi(String(m.hasGroups ? m.groupCount : m.rowCount), m.hasGroups ? "Resourcegroepen" : "Regels");
  var kpis =
    kpi(money(m.total), "Totale uitgaven") +
    kpi(esc(periodText(m)), "Periode") +
    kpi(String(m.categoryCount), "Categorieën") +
    fourth +
    (m.hasTags ? kpi(Math.round(m.untaggedShare * 100) + "%", "Zonder tags") : "");

  var signals = buildSignals(m, money);
  var sevLabel = { high: "Actie", med: "Let op", info: "Ter info" };
  var signalsHTML = "<h3>Signalen</h3><ul class=\"signals\">" +
    signals.map(function (s) {
      var tag = s.severity && sevLabel[s.severity] ? "<span class=\"sev sev-" + s.severity + "\">" + sevLabel[s.severity] + "</span> " : "";
      return "<li class=\"sig-" + (s.severity || "info") + "\"><strong>" + tag + esc(s.title) + "</strong>" + esc(s.body) + "</li>";
    }).join("") + "</ul>";

  var sampleBanner = isSample
    ? "<div class=\"note sample-banner\">Dit is een voorbeeldrapport met verzonnen data — geen echte Azure-kosten.</div>"
    : "";

  container.innerHTML =
    sampleBanner +
    "<div class=\"kpis\">" + kpis + "</div>" +
    signalsHTML +
    monthsTableHTML(m, money) +
    tableHTML("Uitgaven per categorie", m.categories, money) +
    (m.hasResources ? tableHTML("Duurste resources", m.resources, money) : "") +
    (m.hasSubscriptions ? tableHTML("Uitgaven per subscription", m.subscriptions, money) : "") +
    (m.hasGroups ? tableHTML("Uitgaven per resourcegroep", m.groups, money) : "");
  container.hidden = false;
}

function kpi(val, lbl) { return "<div class=\"kpi\"><div class=\"val\">" + val + "</div><div class=\"lbl\">" + lbl + "</div></div>"; }

/* ---------------------------------------------------------------- findings CSV */

function csvCell(v) {
  var s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? "\"" + s.replace(/"/g, "\"\"") + "\"" : s;
}

function buildFindingsCSV(m) {
  var header = ["resourceId", "subscription", "resourceGroup", "category", "cost", "unusedReservationCost", "top5Concentrated", "note"];
  var top5Names = {};
  (m.resources || []).slice(0, 5).forEach(function (r) { top5Names[r.name] = true; });
  var watch = { "Bandwidth": "uitgaand dataverkeer (egress) is een klassieke plek waar kosten sluipen",
                "Storage": "oude snapshots en losgekoppelde disks blijven vaak doorlopen",
                "Load Balancer": "load balancers en ongebruikte publieke IP’s blijven doortikken, ook zonder verkeer",
                "Virtual Machines": "onbenutte of te ruim bemeten VM’s vallen zelden vanzelf op" };
  var lines = [header.join(",")];
  (m.resourceFindings || []).forEach(function (f) {
    var isTop5 = top5Names[lastSegment(f.resourceId)] ? "ja" : "nee";
    lines.push([
      csvCell(f.resourceId), csvCell(f.subscription), csvCell(f.resourceGroup), csvCell(f.category),
      f.cost.toFixed(2), f.unusedReservationCost.toFixed(2), isTop5, csvCell(watch[f.category] || "")
    ].join(","));
  });
  return lines.join("\r\n");
}

/* -------------------------------------------------------------------- init  */

export function init(mount) {
  if (mount.dataset.scanReady) return mount._api;
  mount.dataset.scanReady = "1";

  var dropzone = mount.querySelector("[data-dropzone]");
  var input = mount.querySelector("[data-file-input]");
  var listEl = mount.querySelector("[data-filelist]");
  var analyzeBtn = mount.querySelector("[data-analyze]");
  var saveBtn = mount.querySelector("[data-save]");
  var saveCsvBtn = mount.querySelector("[data-save-csv]");
  var statusEl = mount.querySelector("[data-status]");
  var resultsEl = mount.querySelector("[data-results]");

  // One entry per opened file: { id, file, name, size, state, months, dataset, error }.
  // state is "reading" | "ready" | "error". Files are parsed as soon as they are opened
  // rather than at analyze time, so the list can show the months each one covers — and the
  // parsed rows are kept, so Analyze reuses them instead of reading everything a second
  // time. Peak memory is unchanged: buildModel already held every dataset at once.
  var files = [];
  var seq = 0;
  var queue = [];
  var draining = false;
  var report = null; // { model, fileNames, isSample, name } — the PDF itself is built on demand
  var findingsCsv = null; // { text, name }

  // The PDF chunk (jspdf + jspdf-autotable, ~124KB gzip — far above what's reasonable to ship
  // on every page load) is only ever reached via this dynamic import. Mirrors the pending/
  // loaded/dead state machine index.astro already uses for scan.js's own load, for the same
  // reason: a failed dynamic import() is cached by the browser as a permanent rejection for
  // that specifier, so a dead flag stops a doomed retry loop rather than refiring forever.
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

  function readyFiles() {
    return files.filter(function (f) { return f.state === "ready" && f.dataset; });
  }

  function monthsText(f) {
    if (f.state === "reading") {
      return f.size >= LARGE_FILE_BYTES
        ? "bezig met lezen… (groot bestand, kan even duren)"
        : "bezig met lezen…";
    }
    if (f.state === "error") return f.error;
    if (!f.months.length) return "geen maand herkend";
    return monthsSummary(f.months);
  }

  // A file can parse fine and still have no recognisable date column, which is neither a
  // success worth highlighting nor a read error — it gets its own muted styling.
  function monthsState(f) {
    return f.state === "ready" && !f.months.length ? "unknown" : f.state;
  }

  function refreshList() {
    if (!files.length) { listEl.hidden = true; listEl.innerHTML = ""; analyzeBtn.disabled = true; return; }
    listEl.hidden = false;
    listEl.innerHTML = files.map(function (f) {
      return "<li><span class=\"fmeta\">" +
               "<span class=\"fname\">" + esc(f.name) + "</span>" +
               "<span class=\"fmonths\" data-state=\"" + monthsState(f) + "\">" + esc(monthsText(f)) + "</span>" +
             "</span>" +
             "<span class=\"size\">" + fmtBytes(f.size) +
             " <button type=\"button\" data-remove=\"" + f.id + "\" aria-label=\"Verwijder\">&times;</button></span></li>";
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
      var entry = { id: ++seq, file: f, name: f.name, size: f.size, state: "reading", months: [], dataset: null, error: "", singleColumn: false };
      files.push(entry);
      queue.push(entry);
      added++;
    });
    refreshList();
    if (!added) { setStatus("Kies .csv-bestanden.", true); return; }
    drain();
  }

  // Parse queued files one at a time — these run up to ~14 MB each, so overlapping them
  // would spike memory for no gain.
  async function drain() {
    if (draining) return;
    draining = true;
    refreshList();

    while (queue.length) {
      var entry = queue.shift();
      if (files.indexOf(entry) === -1) continue; // removed while queued
      setStatus("‘" + entry.name + "’ lezen…");
      try {
        await nextFrame();
        var text = await readText(entry.file);
        var delim = sniffDelimiter(text);
        var rows = await parseCSV(text, delim, function (n) {
          setStatus("‘" + entry.name + "’ lezen… (" + n.toLocaleString("nl-NL") + " regels)");
        });
        text = null; // release the raw string before parsing the next file
        if (files.indexOf(entry) === -1) continue; // removed while it was being read
        entry.singleColumn = rows.length > 0 && rows[0].length <= 1;
        if (rows.length < 2) {
          entry.state = "error";
          entry.error = "geen leesbare rijen";
        } else {
          entry.dataset = { cols: detectColumns(rows[0]), rows: rows.slice(1) };
          entry.months = datasetMonths(entry.dataset);
          entry.state = "ready";
        }
      } catch (err) {
        entry.state = "error";
        entry.error = "kon niet gelezen worden";
        if (window.console) console.error("read failed", entry.name, err);
      }
      refreshList();
    }

    draining = false;
    refreshList();
    var ready = readyFiles().length;
    setStatus(ready ? ready + " bestand(en) klaar om te analyseren." : "Geen bruikbare bestanden.", !ready);
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
    setStatus(files.length ? ready + " bestand(en) klaar." : "");
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

  // Shared by the real Analyze click and the sample-report click below, so render/save/status
  // logic exists exactly once. datasets/fileNames come pre-parsed in both cases.
  async function runAnalysis(datasets, fileNames, isSample) {
    analyzeBtn.disabled = true;
    saveBtn.hidden = true;
    saveCsvBtn.hidden = true;
    report = null;
    findingsCsv = null;

    try {
      if (!datasets.length) { setStatus("Kon geen bruikbare rijen lezen. Is dit een Azure-verbruiks-CSV?", true); return; }
      if (!datasets.some(function (d) { return d.cols.cost !== -1; })) {
        var delimIssue = !isSample && readyFiles().some(function (f) { return f.singleColumn; });
        setStatus(delimIssue
          ? "Geen kostenkolom gevonden — het bestand lijkt niet op komma's of puntkomma's gesplitst te zijn. Is dit een onbewerkte Azure-export?"
          : "Geen kostenkolom gevonden. Verwacht een kolom zoals ‘CostInBillingCurrency’ of ‘Cost’.", true);
        return;
      }

      setStatus(isSample ? "Voorbeeld analyseren…" : "Analyseren…");
      await nextFrame();
      var model = buildModel(datasets);
      if (!model.ok) { setStatus("Geen kostenregels gevonden in het bestand.", true); return; }

      renderResults(resultsEl, model, isSample);
      var datePart = new Date().toISOString().slice(0, 10);
      var reportName = isSample
        ? "azure-waste-scan-VOORBEELD-" + datePart + ".pdf"
        : "azure-waste-scan-rapport-" + datePart + ".pdf";
      // The PDF itself is built lazily, on the Save click — this just remembers what it'll
      // need. Fire a background prefetch of the (large) PDF chunk now, right after a real
      // result exists to save: the app is built to keep working after the network is cut
      // (see the connectivity indicator/loader below), so waiting until the click itself to
      // start this fetch would strand anyone who goes offline between finishing a scan and
      // clicking Save — a very plausible order given the page invites exactly that.
      report = { model: model, fileNames: fileNames, isSample: isSample, name: reportName };
      saveBtn.hidden = false;
      loadPdfModule().catch(function () {}); // failure surfaced later, on click, if it matters
      if (model.hasFindings) {
        findingsCsv = { text: buildFindingsCSV(model), name: "azure-waste-scan-resources-" + datePart + ".csv" };
        saveCsvBtn.hidden = false;
      }
      setStatus((isSample ? "Voorbeeld klaar — " : "Analyse klaar — ") +
        model.rowCount.toLocaleString("nl-NL") + " regels uit " + fileNames.length + " bestand(en) verwerkt.");
    } catch (err) {
      if (window.console) console.error(err);
      setStatus("Er ging iets mis bij het lezen van de bestanden.", true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  analyzeBtn.addEventListener("click", function () {
    var ready = readyFiles();
    if (!ready.length) return;
    // Already parsed when the files were opened — nothing is read twice.
    runAnalysis(ready.map(function (f) { return f.dataset; }), ready.map(function (f) { return f.name; }), false);
  });

  // Zero-effort preview, no file needed. No longer a button inside this mount — called from
  // the hero's "Bekijk een voorbeeldrapport" link instead (see index.astro), exposed on the
  // object init() returns so that link works whether scan.js is already loaded or not.
  //
  // `win` is a tab already opened by window.open() in the click handler itself, before any
  // await ran — opening it here instead would get blocked as a popup by most browsers, since
  // by the time this async function reaches its first await it's no longer considered to be
  // running synchronously inside the click that triggered it. We just navigate that tab to
  // the finished PDF once it's ready, rather than downloading it.
  async function viewSample(win) {
    try {
      var rows = await parseCSV(SAMPLE_CSV, ",");
      var dataset = { cols: detectColumns(rows[0]), rows: rows.slice(1) };
      await runAnalysis([dataset], ["Voorbeelddata (synthetisch)"], true);
      var mod = await loadPdfModule();
      var blob = await mod.buildReportPDF(report.model, report.fileNames, report.isSample);
      var url = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        // The pre-opened tab got closed (or never opened — some browsers hand back null even
        // for a synchronous window.open) — best-effort retry, though this one, not being
        // synchronous with the original click, may itself get blocked.
        win = window.open(url, "_blank");
        if (!win) setStatus("Kon het voorbeeldrapport niet in een nieuw tabblad openen — check of pop-ups geblokkeerd worden.", true);
      }
    } catch (err) {
      if (window.console) console.error(err);
      if (win && !win.closed) win.close();
      setStatus("Er ging iets mis bij het maken van het voorbeeldrapport.", true);
    }
  }

  // --- save report (PDF, built on demand) ---
  saveBtn.addEventListener("click", async function () {
    if (!report) return;
    saveBtn.disabled = true;
    setStatus("PDF genereren…");
    try {
      var mod = await loadPdfModule();
      var blob = await mod.buildReportPDF(report.model, report.fileNames, report.isSample);
      downloadBlob(blob, report.name);
      setStatus("PDF opgeslagen.");
    } catch (err) {
      if (window.console) console.error(err);
      setStatus(pdfDead || !navigator.onLine
        ? "PDF-module kon niet laden. Controleer je verbinding en probeer opnieuw, of ververs de pagina."
        : "Er ging iets mis bij het maken van de PDF.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // --- save findings CSV ---
  saveCsvBtn.addEventListener("click", function () {
    if (!findingsCsv) return;
    downloadBlob(findingsCsv.text, findingsCsv.name, "text/csv");
  });

  function downloadBlob(data, name, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var api = { viewSample: viewSample };
  mount._api = api;
  return api;
}
