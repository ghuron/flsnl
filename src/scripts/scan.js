// scan.js — the Azure Waste Scan analyzer. Runs entirely in the browser.
// Loaded on demand by boot.js. Nothing here makes a network request; files are
// read locally via the File API and the report is saved as a local download.
"use strict";

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

// RFC-4180-ish CSV parser tuned for large files (14 MB MCA exports): unquoted
// fields are sliced with indexOf instead of char-by-char concatenation, and
// only quoted fields fall into the slow path. Handles escaped quotes and CRLF.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  var rows = [], row = [], i = 0, n = text.length;
  // Consume the delimiter after a field; returns new index. Ends the row on EOL.
  function afterField(idx) {
    var c = text[idx];
    if (c === ",") return idx + 1;
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
      while (next < n) { var cc = text.charCodeAt(next); if (cc === 44 || cc === 10 || cc === 13) break; next++; }
      row.push(text.slice(i, next));
      i = afterField(next);
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

function detectColumns(header) {
  return {
    cost: pickColumn(header, ["costinbillingcurrency", "costusd", "cost", "pretaxcost", "extendedcost", "billingcost", "paygtotal", "pretaxcostusd", "amount"]),
    paygCost: pickColumn(header, ["paygcostinbillingcurrency", "paygcostinusd", "paygprice"]),
    currency: pickColumn(header, ["billingcurrency", "billingcurrencycode", "currency", "currencycode"]),
    category: pickColumn(header, ["metercategory", "consumedservice", "servicename", "servicefamily", "productname", "product", "metersubcategory"]),
    resourceGroup: pickColumn(header, ["resourcegroup", "resourcegroupname"]),
    resource: pickColumn(header, ["resourcename", "resourceid", "instanceid", "instancename"]),
    subscription: pickColumn(header, ["subscriptionname", "subscriptionid", "subscriptionguid"]),
    date: pickColumn(header, ["date", "usagedate", "servicedate", "usagedatetime"]),
    period: pickColumn(header, ["billingperiodstartdate", "billingperiod", "billingperiodstart"]),
    chargeType: pickColumn(header, ["chargetype"]),
    pricingModel: pickColumn(header, ["pricingmodel"]),
    reservation: pickColumn(header, ["reservationname", "benefitname"])
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
  var total = 0, rowCount = 0, negatives = 0, creditsTotal = 0, unusedCommitment = 0;
  var onDemandCost = 0, commitmentCost = 0, coverageKnown = 0;
  var paygSum = 0, paygKnown = 0;
  var byCategory = new Map();
  var byGroup = new Map();
  var byResource = new Map();
  var bySubscription = new Map();
  var byMonth = new Map();
  var byMonthCat = new Map(); // monthKey -> Map(category -> cost)
  var currencies = new Set();
  var anyCost = false, anyGroup = false, anyResource = false, anySub = false, anyMonth = false, anyCoverage = false;

  datasets.forEach(function (ds) {
    var cols = ds.cols, rows = ds.rows;
    if (cols.cost === -1) return;
    anyCost = true;
    if (cols.resourceGroup !== -1) anyGroup = true;
    if (cols.resource !== -1) anyResource = true;
    if (cols.subscription !== -1) anySub = true;
    if (cols.date !== -1 || cols.period !== -1) anyMonth = true;
    if (cols.pricingModel !== -1) anyCoverage = true;
    var dateCol = cols.date !== -1 ? cols.date : cols.period;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cost = parseNum(row[cols.cost]);
      total += cost;
      rowCount++;
      if (cost < 0) negatives++;

      if (cols.currency !== -1 && row[cols.currency]) currencies.add(String(row[cols.currency]).trim().toUpperCase());

      var charge = cols.chargeType !== -1 ? norm2(row[cols.chargeType]) : "";
      if (charge === "refund" || charge === "credit" || charge === "roundingadjustment") creditsTotal += cost;
      if (charge === "unusedreservation" || charge === "unusedsavingsplan") unusedCommitment += cost;

      if (cols.pricingModel !== -1) {
        var pm = norm2(row[cols.pricingModel]);
        if (pm) {
          coverageKnown += cost;
          if (pm === "ondemand" || pm === "spot") onDemandCost += cost;
          else commitmentCost += cost; // reservation / savingsplan
        }
      }
      if (cols.paygCost !== -1) { paygSum += parseNum(row[cols.paygCost]); paygKnown += cost; }

      var cat = cols.category !== -1 ? (String(row[cols.category] || "").trim() || "(onbekend)") : "(alle)";
      byCategory.set(cat, (byCategory.get(cat) || 0) + cost);

      if (cols.resourceGroup !== -1) {
        var g = String(row[cols.resourceGroup] || "").trim() || "(geen)";
        byGroup.set(g, (byGroup.get(g) || 0) + cost);
      }
      if (cols.resource !== -1) {
        var res = lastSegment(String(row[cols.resource] || "").trim()) || "(geen)";
        byResource.set(res, (byResource.get(res) || 0) + cost);
      }
      if (cols.subscription !== -1) {
        var sub = String(row[cols.subscription] || "").trim() || "(geen)";
        bySubscription.set(sub, (bySubscription.get(sub) || 0) + cost);
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

  // Category that grew most between the last two months.
  var catRiser = null;
  if (monthKeys.length >= 2) {
    var prevK = monthKeys[monthKeys.length - 2], lastK = monthKeys[monthKeys.length - 1];
    var prevMap = byMonthCat.get(prevK) || new Map(), lastMap = byMonthCat.get(lastK) || new Map();
    var names = new Set([].concat(Array.from(prevMap.keys()), Array.from(lastMap.keys())));
    names.forEach(function (name) {
      var pv = prevMap.get(name) || 0, lv = lastMap.get(name) || 0, delta = lv - pv;
      if (!catRiser || delta > catRiser.delta) catRiser = { name: name, prev: pv, last: lv, delta: delta };
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
    _catRiser: catRiser,
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
    generatedAt: new Date()
  };
}

/* --------------------------------------------------------------- formatting */

function makeMoney(currency) {
  var valid = /^[A-Z]{3}$/.test(currency);
  var nf;
  try {
    nf = valid ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: currency, maximumFractionDigits: 0 })
               : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
  } catch (e) {
    nf = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });
  }
  return function (n) {
    var s = nf.format(n || 0);
    return valid ? s : s + (currency ? " " + currency : "");
  };
}

// Honest signals, phrased as questions/observations rather than verdicts. Each
// is only emitted when the underlying columns are present in the data.
function buildSignals(m, money) {
  var out = [];

  // 1. Unused reservations / savings plans — literally paid-for, unconsumed commitment.
  if (m.unusedCommitment > 0) {
    out.push({ severity: "high", title: "Ongebruikte reserveringen of savings plans",
      body: "Er is " + money(m.unusedCommitment) + " aan gereserveerde capaciteit betaald die niet is verbruikt (chargeType ‘Unused…’). " +
            "Dat is geld dat nu weglekt — controleer of de reservering nog past bij wat je draait." });
  }

  // 2. Reservation/savings coverage — steady compute at full on-demand price.
  if (m.hasCoverage && m.onDemandShare >= 0.85 && m.onDemandCost / (m.total || 1) >= 0.3) {
    out.push({ severity: "med", title: "Vrijwel alles wordt on-demand betaald",
      body: Math.round(m.onDemandShare * 100) + "% van je verbruik loopt tegen het on-demand-tarief (" + money(m.onDemandCost) + "). " +
            "Voor wat maand na maand blijft draaien is een reservering of savings plan doorgaans 20–60% goedkoper — dat is de eerste plek om te kijken." });
  }

  // 3. Month-over-month trend across multiple periods.
  if (m.hasMonths && m.months.length >= 2) {
    var a = m.months[m.months.length - 2], b = m.months[m.months.length - 1];
    if (a.cost > 0) {
      var pct = (b.cost - a.cost) / a.cost;
      if (Math.abs(pct) >= 0.1) {
        out.push({ severity: pct > 0 ? "med" : "info",
          title: "Je rekening " + (pct > 0 ? "stijgt" : "daalt") + " (" + (pct > 0 ? "+" : "") + Math.round(pct * 100) + "% laatste maand)",
          body: b.label + " was " + money(b.cost) + " tegenover " + money(a.cost) + " in " + a.label + ". " +
                (pct > 0 ? "Kijk welke categorie de stijging veroorzaakt — die staat hieronder." : "Mooi — maar controleer of er niets is uitgezet dat wél nodig was.") });
      }
    }
    var riser = biggestCategoryRiser(m);
    if (riser && riser.delta > 0 && riser.delta / (m.total || 1) >= 0.03) {
      out.push({ severity: "info", title: "Grootste stijger: " + riser.name,
        body: riser.name + " groeide van " + money(riser.prev) + " naar " + money(riser.last) + " (+" + money(riser.delta) + "). Waarschijnlijk waar de stijging vandaan komt." });
    }
  }

  // 4. Concentration — where optimisation pays off most.
  if (m.hasResources && m.concentrationTop5 >= 0.4 && m.resourceCount > 5) {
    out.push({ severity: "info", title: "Je uitgaven zijn geconcentreerd",
      body: "De vijf duurste resources zijn samen " + Math.round(m.concentrationTop5 * 100) +
            "% van je totale rekening. Dat is waar een optimalisatie het meeste oplevert — begin daar." });
  }

  // 5. Category watchlist — classic places waste hides.
  var watch = { "Bandwidth": "uitgaand dataverkeer (egress) is een klassieke plek waar kosten sluipen",
                "Storage": "oude snapshots en losgekoppelde disks blijven vaak doorlopen",
                "Load Balancer": "load balancers en ongebruikte publieke IP’s blijven doortikken, ook zonder verkeer",
                "Virtual Machines": "onbenutte of te ruim bemeten VM’s vallen zelden vanzelf op" };
  m.categories.forEach(function (c) {
    if (watch[c.name] && m.total > 0 && c.cost / m.total >= 0.05) {
      out.push({ severity: "info", title: c.name + " — waard om te bekijken",
        body: c.name + " is " + money(c.cost) + " (" + Math.round(c.cost / m.total * 100) + "% van je rekening): " + watch[c.name] + "." });
    }
  });

  // 6. Data-quality notes.
  if (m.creditsTotal !== 0) {
    out.push({ severity: "info", title: "Credits en correcties zijn meegerekend",
      body: "Het bestand bevat " + money(m.creditsTotal) + " aan afrondingen, kortingen of terugboekingen (chargeType ‘Refund’/‘RoundingAdjustment’). Die zitten in het totaal." });
  }
  if (m.currencies.length > 1) {
    out.push({ severity: "med", title: "Meerdere valuta in één set",
      body: "De bestanden bevatten bedragen in " + m.currencies.join(", ") + ". Het totaal telt de ruwe bedragen op zonder om te rekenen — houd daar rekening mee." });
  }

  if (!out.length) {
    out.push({ severity: "info", title: "Geen opvallende patronen in dit overzicht",
      body: "Op factuurniveau springt er niets uit. Een geverifieerd oordeel vraagt meer dan een factuur: productietoegang, historie en je eigen engineers erbij — dat is de aparte, betaalde stap." });
  }
  return out;
}

// Which category grew the most between the last two months.
function biggestCategoryRiser(m) {
  if (!m.hasMonths || m.months.length < 2) return null;
  // Rebuilt from per-row data would be ideal; approximate from category totals
  // is not possible without per-month category breakdown, so use it only when present.
  return m._catRiser || null;
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

function periodText(m) {
  if (!m.hasMonths || !m.months.length) return "—";
  var f = m.months[0].label, l = m.months[m.months.length - 1].label;
  return f === l ? f : f + " → " + l;
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

function renderResults(container, m) {
  var money = makeMoney(m.currency === "MIXED" ? "" : m.currency);
  var fourth = m.hasCoverage
    ? kpi(Math.round(m.onDemandShare * 100) + "%", "On-demand")
    : kpi(String(m.hasGroups ? m.groupCount : m.rowCount), m.hasGroups ? "Resourcegroepen" : "Regels");
  var kpis =
    kpi(money(m.total), "Totale uitgaven") +
    kpi(esc(periodText(m)), "Periode") +
    kpi(String(m.categoryCount), "Categorieën") +
    fourth;

  var signals = buildSignals(m, money);
  var sevLabel = { high: "Actie", med: "Let op", info: "Ter info" };
  var signalsHTML = "<h3>Signalen</h3><ul class=\"signals\">" +
    signals.map(function (s) {
      var tag = s.severity && sevLabel[s.severity] ? "<span class=\"sev sev-" + s.severity + "\">" + sevLabel[s.severity] + "</span> " : "";
      return "<li class=\"sig-" + (s.severity || "info") + "\"><strong>" + tag + esc(s.title) + "</strong>" + esc(s.body) + "</li>";
    }).join("") + "</ul>";

  container.innerHTML =
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

/* ------------------------------------------------------------ saved report  */

function buildReportHTML(m, fileNames) {
  var money = makeMoney(m.currency === "MIXED" ? "" : m.currency);
  var signals = buildSignals(m, money);
  function t(title, rows) {
    if (!rows.length) return "";
    return "<h2>" + esc(title) + "</h2><table><thead><tr><th>Naam</th><th class=num>Kosten</th></tr></thead><tbody>" +
      rows.map(function (r) { return "<tr><td>" + esc(r.name) + "</td><td class=num>" + esc(money(r.cost)) + "</td></tr>"; }).join("") +
      "</tbody></table>";
  }
  function monthsTable() {
    if (!m.hasMonths || m.months.length < 2) return "";
    return "<h2>Verloop per maand</h2><table><thead><tr><th>Maand</th><th class=num>Kosten</th></tr></thead><tbody>" +
      m.months.map(function (r) { return "<tr><td>" + esc(r.label) + "</td><td class=num>" + esc(money(r.cost)) + "</td></tr>"; }).join("") +
      "</tbody></table>";
  }
  var stamp = m.generatedAt.toLocaleString("nl-NL");
  return "<!doctype html><html lang=nl><head><meta charset=utf-8>" +
    "<meta name=viewport content=\"width=device-width, initial-scale=1\">" +
    "<title>Azure Waste Scan — rapport</title><style>" +
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0e0e2a;line-height:1.6;max-width:820px;margin:2rem auto;padding:0 1.25rem}" +
    "h1{font-size:1.7rem;margin:0 0 .3rem}h2{font-size:1.15rem;margin:2rem 0 .6rem;border-bottom:2px solid #d4d9df;padding-bottom:.3rem}" +
    ".meta{color:#475569;font-size:.9rem;margin-bottom:1.5rem}" +
    ".kpis{display:flex;flex-wrap:wrap;gap:1rem;margin:1.25rem 0}.k{border:1px solid #d4d9df;border-radius:10px;padding:.9rem 1.1rem;min-width:150px}" +
    ".k .v{font-size:1.4rem;font-weight:800}.k .l{color:#475569;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}" +
    "table{border-collapse:collapse;width:100%;font-size:.92rem}th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid #d4d9df}td.num,th.num{text-align:right;white-space:nowrap}" +
    "ul{padding-left:0;list-style:none}li{background:#f5f5f7;border-left:3px solid #6c43ff;border-radius:0 8px 8px 0;padding:.7rem .9rem;margin:.5rem 0}" +
    "li b{display:block}footer{margin-top:2.5rem;color:#475569;font-size:.85rem;border-top:1px solid #d4d9df;padding-top:1rem}" +
    "</style></head><body>" +
    "<h1>Azure Waste Scan — rapport</h1>" +
    "<div class=meta>Gegenereerd op " + esc(stamp) + " · Bron: " + esc(fileNames.join(", ")) + " · Periode: " + esc(periodText(m)) + "</div>" +
    "<div class=kpis>" +
      "<div class=k><div class=v>" + esc(money(m.total)) + "</div><div class=l>Totale uitgaven</div></div>" +
      "<div class=k><div class=v>" + esc(String(m.categoryCount)) + "</div><div class=l>Categorieën</div></div>" +
      (m.hasCoverage ? "<div class=k><div class=v>" + Math.round(m.onDemandShare * 100) + "%</div><div class=l>On-demand</div></div>" : "") +
      "<div class=k><div class=v>" + esc(String(m.rowCount)) + "</div><div class=l>Regels</div></div>" +
    "</div>" +
    "<h2>Signalen</h2><ul>" +
      signals.map(function (s) { return "<li><b>" + esc(s.title) + "</b>" + esc(s.body) + "</li>"; }).join("") + "</ul>" +
    monthsTable() +
    t("Uitgaven per categorie", m.categories) +
    (m.hasResources ? t("Duurste resources", m.resources) : "") +
    (m.hasSubscriptions ? t("Uitgaven per subscription", m.subscriptions) : "") +
    (m.hasGroups ? t("Uitgaven per resourcegroep", m.groups) : "") +
    "<footer>Dit rapport is volledig in de browser gegenereerd; er is geen data verzonden. De patronen zijn compleet en van jou. " +
    "Een geverifieerd oordeel vraagt productietoegang, meer historie dan een factuur laat zien, en je eigen engineers erbij — een aparte, betaalde stap.</footer>" +
    "</body></html>";
}

/* -------------------------------------------------------------------- init  */

export function init(mount) {
  if (mount.dataset.scanReady) return;
  mount.dataset.scanReady = "1";

  var dropzone = mount.querySelector("[data-dropzone]");
  var input = mount.querySelector("[data-file-input]");
  var listEl = mount.querySelector("[data-filelist]");
  var analyzeBtn = mount.querySelector("[data-analyze]");
  var saveBtn = mount.querySelector("[data-save]");
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
  var report = null; // { html, name }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", !!isError);
  }

  function readyFiles() {
    return files.filter(function (f) { return f.state === "ready" && f.dataset; });
  }

  function monthsText(f) {
    if (f.state === "reading") return "bezig met lezen…";
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
      var entry = { id: ++seq, file: f, name: f.name, size: f.size, state: "reading", months: [], dataset: null, error: "" };
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
        var rows = parseCSV(text);
        text = null; // release the raw string before parsing the next file
        if (files.indexOf(entry) === -1) continue; // removed while it was being read
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

  // Yield to the event loop so the status text actually repaints between the
  // heavy synchronous parse of each (up to ~14 MB) file.
  function nextFrame() { return new Promise(function (r) { setTimeout(r, 0); }); }

  analyzeBtn.addEventListener("click", async function () {
    var ready = readyFiles();
    if (!ready.length) return;
    analyzeBtn.disabled = true;
    saveBtn.hidden = true;
    report = null;

    try {
      // Already parsed when the files were opened — nothing is read twice.
      var datasets = ready.map(function (f) { return f.dataset; });

      if (!datasets.length) { setStatus("Kon geen bruikbare rijen lezen. Is dit een Azure-verbruiks-CSV?", true); analyzeBtn.disabled = false; return; }
      if (!datasets.some(function (d) { return d.cols.cost !== -1; })) {
        setStatus("Geen kostenkolom gevonden. Verwacht een kolom zoals ‘CostInBillingCurrency’ of ‘Cost’.", true);
        analyzeBtn.disabled = false; return;
      }

      setStatus("Analyseren…");
      await nextFrame();
      var model = buildModel(datasets);
      if (!model.ok) { setStatus("Geen kostenregels gevonden in het bestand.", true); analyzeBtn.disabled = false; return; }

      renderResults(resultsEl, model);
      var stampName = "azure-waste-scan-rapport-" + new Date().toISOString().slice(0, 10) + ".html";
      // `ready`, not `files` — a file that failed to parse must not be named in the report
      // or counted in the summary line.
      report = { html: buildReportHTML(model, ready.map(function (f) { return f.name; })), name: stampName };
      saveBtn.hidden = false;
      analyzeBtn.disabled = false;
      setStatus("Analyse klaar — " + model.rowCount.toLocaleString("nl-NL") + " regels uit " + ready.length + " bestand(en) verwerkt.");
    } catch (err) {
      if (window.console) console.error(err);
      setStatus("Er ging iets mis bij het lezen van de bestanden.", true);
      analyzeBtn.disabled = false;
    }
  });

  // --- save report ---
  saveBtn.addEventListener("click", function () {
    if (!report) return;
    var blob = new Blob([report.html], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = report.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
}
