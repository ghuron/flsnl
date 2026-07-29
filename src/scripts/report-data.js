// The data layer behind the PDF report (pdf/buildReportPDF.js) — the only report there is, the
// scan produces no on-screen results. No DOM/jsPDF dependency here — pure data-in,
// string/function-out. All display text comes from strings.js; this file only decides *which*
// signals fire and *what values* go into them — never the words themselves.
"use strict";

import { textFor } from "./strings.js";

// The single definition of how a share is rendered. buildSignals and the PDF both use it,
// so a KPI tile and the table beneath it cannot round the same number differently.
function pct(x) { return Math.round(x * 100) + "%"; }

function makeMoney(currency, lang) {
  var locale = textFor(lang).locale;
  var valid = /^[A-Z]{3}$/.test(currency);
  var nf;
  try {
    nf = valid ? new Intl.NumberFormat(locale, { style: "currency", currency: currency, maximumFractionDigits: 0 })
               : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  } catch (e) {
    nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  }
  return function (n) {
    var s = nf.format(n || 0);
    return valid ? s : s + (currency ? " " + currency : "");
  };
}

// A "YYYY-MM" key to its display label ("mei 2026" / "May 2026"). The single place month
// keys become language text, so buildModel (which bakes .label into every months[] entry at
// analysis time — a scan only ever renders in one language, so there is no need to defer
// this to render time) and periodText agree on wording by construction.
function monthLabel(key, lang) {
  var p = key.split("-");
  return p.length === 2 ? textFor(lang).months[parseInt(p[1], 10)] + " " + p[0] : key;
}

// Honest signals, phrased as questions/observations rather than verdicts. Each is only
// emitted when the underlying columns are present in the data.
//
// Returns sections rather than one flat list, because the split is the point: what your own
// team can settle with a setting, versus what is baked into how the application is built.
// The second kind is what a bill can only ever raise as a question — and what the paid study
// exists to answer. Both renderers (on-screen and PDF) walk the same structure.
function buildSignals(m, money, lang) {
  var S = textFor(lang);
  var T = S.signals;
  var self = [], engineering = [], notes = [];

  /* ---------------------------------------------- what your own team can settle */

  // Unused reservations / savings plans — literally paid-for, unconsumed commitment.
  if (m.unusedCommitment > 0) {
    self.push(Object.assign({ severity: "high" }, T.unusedReservation(money(m.unusedCommitment))));
  }

  // Untagged spend — the number worth forwarding to management as-is.
  if (m.hasTags && m.untaggedShare >= 0.3) {
    self.push(Object.assign({ severity: "med" }, T.untaggedSpend(pct(m.untaggedShare), money(m.untaggedCost))));
  }

  // Reservation/savings coverage. The second sentence is deliberate: buying a three-year
  // reservation for something that shouldn't run at all locks the waste in instead of fixing
  // it, so the cheap win and the structural question get named together.
  if (m.hasCoverage && m.onDemandShare >= 0.85 && m.onDemandCost / (m.total || 1) >= 0.3) {
    self.push(Object.assign({ severity: "med" }, T.onDemandCoverage(pct(m.onDemandShare), money(m.onDemandCost))));
  }

  // Marketplace subscriptions: third-party software billed through Azure, easy to forget.
  if (m.marketplaceCost > 0 && m.marketplaceCost / (m.total || 1) >= 0.02) {
    self.push(Object.assign({ severity: "info" }, T.marketplace(money(m.marketplaceCost), pct(m.marketplaceCost / m.total))));
  }

  // Windows/SQL licence surcharge — Hybrid Benefit candidate if the licences are already owned.
  if (m.licenseCost > 0 && m.licenseCost / (m.total || 1) >= 0.03) {
    self.push(Object.assign({ severity: "info" }, T.license(money(m.licenseCost))));
  }

  // Month-over-month trend.
  if (m.hasMonths && m.months.length >= 2) {
    var a = m.months[m.months.length - 2], b = m.months[m.months.length - 1];
    if (a.cost > 0) {
      var delta = (b.cost - a.cost) / a.cost;
      if (Math.abs(delta) >= 0.1) {
        self.push(Object.assign({ severity: delta > 0 ? "med" : "info" },
          T.monthTrend(delta > 0, Math.round(Math.abs(delta) * 100), b.label, money(b.cost), a.label, money(a.cost))));
      }
    }
    var movers = (m._catMovers || []).filter(function (x) { return x.delta > 0 && x.delta / (m.total || 1) >= 0.03; });
    if (movers.length) {
      var top = movers[0];
      self.push(Object.assign({ severity: "info" }, T.biggestMover(top.name, money(top.prev), money(top.last), money(top.delta))));
      var rest = movers.slice(1, 4);
      if (rest.length) {
        self.push(Object.assign({ severity: "info" },
          T.otherMovers(rest.map(function (x) { return x.name + " (+" + money(x.delta) + ")"; }))));
      }
    }
    // Materiality guard: a brand-new category under 10% of the bill isn't worth a line —
    // "Foundry Tools ($1) wasn't there last month" tells the reader nothing useful.
    var freshMaterial = (m._newCategories || []).filter(function (x) { return x.cost / (m.total || 1) >= 0.10; });
    if (freshMaterial.length) {
      var fresh = freshMaterial.slice(0, 3);
      self.push(Object.assign({ severity: "info" },
        T.newThisMonth(fresh.map(function (x) { return x.name + " (" + money(x.cost) + ")"; }))));
    }
  }

  // Concentration — where any optimisation pays off most.
  if (m.hasResources && m.concentrationTop5 >= 0.4 && m.resourceCount > 5) {
    self.push(Object.assign({ severity: "info" }, T.concentration(pct(m.concentrationTop5))));
  }

  // Weekend flatness. The clearest thing a bill can say about whether a workload follows
  // demand at all: if Sunday costs what Tuesday costs, nothing is scaling down. This is a
  // scheduling job (auto-shutdown, scale-to-zero), not a rebuild — self-service, not engineering.
  if (m.weekendRatio !== null && m.weekendRatio >= 0.9 && m.computeShare >= 0.15) {
    // Stated as a ratio, not as two amounts: money() rounds to whole units, and two nearly
    // identical averages would print as different figures — the opposite of the point.
    self.push(Object.assign({ severity: "high" }, T.weekendFlatness(pct(m.weekendRatio), m.dayCount)));
  }

  // Non-production environments that never stop. Office-hours arithmetic is applied only to
  // the compute part and the assumption is stated, because storage attached to a stopped
  // environment keeps costing the same. Also self-service: a start/stop schedule or Azure
  // DevTest Labs handles this without touching the application.
  if (m.nonProdCount > 0 && m.nonProdCost / (m.total || 1) >= 0.05) {
    var months = (m.months || []).length;
    var perMonth = months > 0 ? m.nonProdSchedulable / months : 0;
    var examples = (m.nonProdExamples || []).join(", ");
    self.push(Object.assign({ severity: "high" },
      T.alwaysOnNonProd(money(m.nonProdCost), pct(m.nonProdCost / m.total), m.nonProdCount, examples, perMonth > 0 ? money(perMonth) : "")));
  }

  // Load Balancer consolidation candidates: several LBs each running mostly flat base fee with
  // negligible real data-processing volume. Wording branches on whether these are Azure's own
  // per-Container-Apps-environment LBs (ME_-prefixed resource groups) or customer-created ones,
  // since "just merge them" is only actually actionable in the latter case.
  if (m.lbCount >= 3 && m.lbCost / (m.total || 1) >= 0.03 && m.lbDataProcessedCost / (m.lbCost || 1) < 0.15) {
    var isManagedEnv = m.lbManagedEnvCount / m.lbCount >= 0.6;
    self.push(Object.assign({ severity: "med" },
      T.lbConsolidation(money(m.lbCost), m.lbCount, pct(m.lbDataProcessedCost / m.lbCost), isManagedEnv)));
  }

  /* ------------------------------------------------------- what engineering asks */

  // Egress relative to compute — a topology question, not a price question.
  if (m.egressCost > 0 && m.computeCost > 0 && m.egressCost / m.computeCost >= 0.1) {
    engineering.push(Object.assign({ severity: "med" }, T.egress(money(m.egressCost), money(m.computeCost), pct(m.egressCost / m.computeCost))));
  }

  // Lift-and-shift fingerprint.
  if (m.iaasShare >= 0.6 && m.total > 0) {
    engineering.push(Object.assign({ severity: "med" }, T.iaasHeavy(pct(m.iaasShare))));
  }

  /* ------------------------------------------------------------- about the numbers */

  // Materiality guard: a few cents of rounding is not worth a line in the report.
  if (m.creditsTotal !== 0 && Math.abs(m.creditsTotal) / (m.total || 1) >= 0.005) {
    notes.push(Object.assign({ severity: "info" }, T.creditsNote(money(m.creditsTotal))));
  }
  if (m.currencies.length > 1) {
    notes.push(Object.assign({ severity: "med" }, T.mixedCurrencies(m.currencies.join(", "))));
  }
  if (m.purchaseCost > 0) {
    notes.push(Object.assign({ severity: "info" }, T.purchasesExcluded(money(m.purchaseCost))));
  }
  // Without day-level rows the two strongest engineering signals cannot be computed at all.
  if (!m.hasDaily && m.hasMonths) {
    notes.push(Object.assign({ severity: "info" }, T.noDailyData()));
  }

  var sections = [];
  if (self.length) {
    sections.push({ key: "self", heading: S.sections.self.heading, intro: S.sections.self.intro, items: self });
  }
  if (engineering.length) {
    sections.push({ key: "engineering", heading: S.sections.engineering.heading, intro: S.sections.engineering.intro, items: engineering });
  } else if (self.length) {
    // Something was worth flagging, but none of it needs re-engineering — say so plainly
    // instead of silently omitting the section, so a reader who disagrees knows to reach out.
    sections.push({ key: "engineering", heading: S.sections.engineering.heading, intro: S.sections.engineering.intro,
      items: [Object.assign({ severity: "info" }, T.noEngineeringOpportunity())] });
  }
  if (!self.length && !engineering.length) {
    sections.push({ key: "clean", heading: S.sections.clean.heading, intro: "", items: [Object.assign({ severity: "info" }, T.clean())] });
  }
  if (notes.length) {
    sections.push({ key: "notes", heading: S.sections.notes.heading, intro: "", items: notes });
  }
  return sections;
}

// Top-5 + "Other", for the PDF's overview page — a deal-size glance, not the customer's own
// analysis (the detail tables elsewhere keep the full top-10 breakdown for that). Negative-cost
// entries (a category or resource that nets below zero on refunds/credits) are dropped from
// both the ranking and the Other bucket: a negative "top spender" reads as a bug, not a finding.
// `presorted` skips the sort for callers that already hand over a cost-descending list — the
// resource ranking is tens of thousands of entries and was being re-sorted for nothing.
function topFiveWithOther(rows, total, presorted) {
  var positive = rows.filter(function (r) { return r.cost > 0; });
  if (!presorted) positive.sort(function (a, b) { return b.cost - a.cost; });
  var top = positive.slice(0, 5);
  var othersCost = positive.slice(5).reduce(function (a, r) { return a + r.cost; }, 0);
  return {
    rows: top.map(function (r) { return { name: r.name, cost: r.cost, pct: r.cost / (total || 1) }; }),
    othersCost: othersCost,
    othersPct: othersCost / (total || 1)
  };
}

function mapToRows(map) {
  return Array.from(map.entries()).map(function (e) { return { name: e[0], cost: e[1] }; });
}

function buildOverview(m) {
  // Months get the same {rows, othersCost, othersPct} shape as every other breakdown (with
  // othersCost always 0 — nothing is ever bucketed away) so the PDF can draw all five with one
  // function, even though months are chronological and uncapped rather than top-5-ranked.
  var monthRows = (m.months || []).map(function (r) { return { name: r.label, cost: r.cost, pct: r.cost / (m.total || 1) }; });
  return {
    months: { rows: monthRows, othersCost: 0, othersPct: 0 },
    categories: topFiveWithOther(mapToRows(m.categoryMap || new Map()), m.total),
    resources: topFiveWithOther(m.resourcesRankedAll || [], m.total, true),
    subscriptions: topFiveWithOther(mapToRows(m.subscriptionMap || new Map()), m.total),
    groups: topFiveWithOther(mapToRows(m.groupMap || new Map()), m.total),
    // A single AI-spend stat rather than the old narrative panel: the token-ratio/cache-share
    // explanation didn't tell a reader anything they could act on, but "AI is N% of the bill"
    // is exactly the kind of thing worth knowing at a glance.
    aiSpend: { cost: m.aiCost || 0, pct: (m.aiCost || 0) / (m.total || 1) }
  };
}

function periodText(m, lang) {
  var S = textFor(lang);
  if (!m.hasMonths || !m.months.length) return S.periodUnknown;
  var f = m.months[0].label, l = m.months[m.months.length - 1].label;
  // En dash, not an arrow: shared with the PDF report, whose standard font only supports
  // WinAnsi — an arrow glyph isn't in that encoding and renders as garbage there.
  return f === l ? f : S.periodRange(f, l);
}

export { makeMoney, pct, buildSignals, periodText, monthLabel, buildOverview };
