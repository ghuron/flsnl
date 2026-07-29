// Builds the downloadable PDF report. Only this file touches jsPDF/jspdf-autotable — it is
// reached exclusively via a runtime import() from scan.js (see loadPdfModule there), never
// statically, so this ~124KB-gzip dependency never loads unless a report is actually saved.
"use strict";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_PNG_BASE64 } from "./logo.js";
import { makeMoney, buildSignals, periodText } from "../report-data.js";

/* ------------------------------------------------------------------ layout */

var PAGE_W = 595, PAGE_H = 842;
var MARGIN = 40;
var CONTENT_W = PAGE_W - MARGIN * 2;
var LOGO_ASPECT = 337 / 253; // logo-fls-white.png, see pdf/logo.js

// Pulled from src/assets/css/site.css custom properties, converted hex -> rgb, so the PDF
// visually matches the on-screen report.
var NAVY = [14, 14, 42];
var BLUE = [15, 98, 254];
var PURPLE = [108, 67, 255];
var INK = [14, 14, 42];
var INK_DIM = [71, 85, 105];
var PANEL = [245, 245, 247];
var LINE = [212, 217, 223];
var WHITE = [255, 255, 255];

var SEV = {
  high: { border: [192, 57, 43], pillBg: [251, 227, 224], pillText: [192, 57, 43], label: "Actie" },
  med: { border: [217, 138, 0], pillBg: [253, 239, 212], pillText: [166, 106, 0], label: "Let op" },
  info: { border: PURPLE, pillBg: [230, 236, 255], pillText: [0, 82, 236], label: "Ter info" }
};

var FOOTER_DISCLAIMER =
  "Dit rapport is volledig in de browser gegenereerd; er is geen data verzonden. De patronen zijn compleet en van jou. " +
  "Een geverifieerd oordeel vraagt productietoegang, meer historie dan een factuur laat zien, en je eigen engineers erbij — een aparte, betaalde stap.";

function setFillRGB(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
function setTextRGB(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
function setDrawRGB(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }

// Shrinks fontSize (down to minSize) until `text` fits maxWidth at the doc's current font/style.
function fitFontSize(doc, text, maxWidth, startSize, minSize) {
  var size = startSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

// Header (navy band + logo + title/meta on page 1, slim variant elsewhere) and footer
// (disclaimer + page number), drawn on whatever page is currently active in `doc`.
function drawPageChrome(doc, opts) {
  var big = opts.big, isSample = opts.isSample, meta = opts.meta;
  var bandH = big ? 92 : 54;

  setFillRGB(doc, NAVY);
  doc.rect(0, 0, PAGE_W, bandH, "F");

  var logoW = big ? 34 : 26, logoH = logoW / LOGO_ASPECT;
  var logoY = big ? 22 : (bandH - logoH) / 2;
  doc.addImage(LOGO_PNG_BASE64, "PNG", MARGIN, logoY, logoW, logoH);

  var titleX = MARGIN + logoW + 14;
  var pillW = 0;
  if (isSample) {
    doc.setFont(undefined, "bold");
    doc.setFontSize(8);
    pillW = doc.getTextWidth("VOORBEELD") + 14;
    var pillH = big ? 18 : 14;
    var pillX = PAGE_W - MARGIN - pillW, pillY = big ? 22 : (bandH - pillH) / 2;
    setFillRGB(doc, SEV.med.pillBg);
    doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, "F");
    setTextRGB(doc, SEV.med.pillText);
    doc.text("VOORBEELD", pillX + pillW / 2, pillY + pillH / 2 + 3, { align: "center" });
    pillW += 12;
  }

  setTextRGB(doc, WHITE);
  if (big) {
    doc.setFont(undefined, "bold");
    doc.setFontSize(20);
    doc.text("Azure Waste Scan — rapport", titleX, 40);

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(199, 203, 230);
    var metaLine = "Gegenereerd op " + meta.stamp + " · Bron: " + meta.fileNames + " · Periode: " + meta.period;
    var metaLines = doc.splitTextToSize(metaLine, PAGE_W - titleX - MARGIN - pillW);
    doc.text(metaLines, titleX, 58);
  } else {
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.text("Azure Waste Scan — rapport", PAGE_W - MARGIN - pillW, bandH / 2 + 3, { align: "right" });
  }

  setDrawRGB(doc, LINE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 800, PAGE_W - MARGIN, 800);
  setTextRGB(doc, INK_DIM);
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  var footerLines = doc.splitTextToSize(FOOTER_DISCLAIMER, CONTENT_W - 90);
  doc.text(footerLines, MARGIN, 812);
  doc.text("Pagina " + doc.getCurrentPageInfo().pageNumber + " van {totalPages}", PAGE_W - MARGIN, 812, { align: "right" });

  setTextRGB(doc, INK); // reset for whatever draws next
}

// Stat tiles (value + label), auto-shrinking the value's font size to fit — periodText() in
// particular can produce a long "mei 2026 → jul 2026"-style string that wouldn't fit a narrow
// tile at a fixed size.
function drawKpiStrip(doc, tiles, x, y, width) {
  var gap = 8, tileH = 60;
  var n = tiles.length;
  var tileW = (width - gap * (n - 1)) / n;

  tiles.forEach(function (t, i) {
    var tx = x + i * (tileW + gap);
    setDrawRGB(doc, LINE);
    setFillRGB(doc, PANEL);
    doc.setLineWidth(1);
    doc.roundedRect(tx, y, tileW, tileH, 6, 6, "FD");

    setTextRGB(doc, INK);
    doc.setFont(undefined, "bold");
    var valText = String(t.val);
    var size = fitFontSize(doc, valText, tileW - 12, 15, 8);
    doc.text(valText, tx + tileW / 2, y + 27, { align: "center" });

    doc.setFont(undefined, "normal");
    doc.setFontSize(7);
    setTextRGB(doc, INK_DIM);
    var lblLines = doc.splitTextToSize(String(t.lbl).toUpperCase(), tileW - 10);
    doc.text(lblLines, tx + tileW / 2, y + 40, { align: "center" });
  });

  return y + tileH;
}

// Signals list, hand-drawn rather than via autotable: each item mixes a bold title with a
// regular body, which doesn't fit autotable's one-fontStyle-per-cell model cleanly. Runs its
// own page-break check (ensureChrome/addPage), since this is the one section not driven by
// autotable's automatic pagination.
function drawSignals(doc, sections, x, yStart, width, addPageFn) {
  var y = yStart;
  var barW = 3, padX = 10, padY = 8, gap = 8, lineH = 11.5, footerReserve = 60;
  var innerW = width - barW - padX * 2;

  sections.forEach(function (sec, secIndex) {
    if (secIndex > 0) y += 10;

    // Measure the heading (plus its intro) and keep them with the first item: a section
    // title stranded alone at the foot of a page reads as a bug.
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    var introLines = sec.intro ? doc.splitTextToSize(sec.intro, width) : [];
    var headH = 18 + (introLines.length ? introLines.length * lineH + 6 : 0);
    if (y + headH + 40 > PAGE_H - footerReserve) y = addPageFn();

    setTextRGB(doc, INK);
    doc.setFont(undefined, "bold");
    doc.setFontSize(13);
    doc.text(sec.heading, x, y);
    y += 18;
    if (introLines.length) {
      setTextRGB(doc, INK_DIM);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.text(introLines, x, y);
      y += introLines.length * lineH + 6;
    }

    sec.items.forEach(function (s) {
      var sev = SEV[s.severity] || SEV.info;

      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      var titleLines = doc.splitTextToSize(s.title, innerW);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      var bodyLines = doc.splitTextToSize(s.body, innerW);

      var pillH = sev.label ? 16 : 0;
      var blockH = padY * 2 + pillH + titleLines.length * lineH + bodyLines.length * lineH;

      if (y + blockH > PAGE_H - footerReserve) {
        y = addPageFn();
      }

      setFillRGB(doc, PANEL);
      doc.roundedRect(x, y, width, blockH, 3, 3, "F");
      setFillRGB(doc, sev.border);
      doc.rect(x, y, barW, blockH, "F");

      var tx = x + barW + padX;
      var cy = y + padY;

      if (sev.label) {
        doc.setFont(undefined, "bold");
        doc.setFontSize(7);
        var pillW = doc.getTextWidth(sev.label) + 12;
        setFillRGB(doc, sev.pillBg);
        doc.roundedRect(tx, cy, pillW, 12, 2, 2, "F");
        setTextRGB(doc, sev.pillText);
        doc.text(sev.label, tx + pillW / 2, cy + 8.5, { align: "center" });
        cy += pillH;
      }

      setTextRGB(doc, INK);
      doc.setFont(undefined, "bold");
      doc.setFontSize(10);
      doc.text(titleLines, tx, cy + 8);
      cy += titleLines.length * lineH;

      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.text(bodyLines, tx, cy + 7);

      y += blockH + gap;
    });
  });

  return y;
}

// One ranked table (months / categories / resources / subscriptions / groups) via
// jspdf-autotable: a synthetic two-row head (navy title bar + dim column-label strip) and a
// proportional bar per row hand-drawn in didDrawCell (autotable has no native "mini
// bar-chart cell" primitive). Pagination is entirely autotable's own — no manual page-break
// check here, unlike drawSignals above.
function drawRankedTable(doc, title, rows, money, startY, ensureChromeForPage) {
  if (!rows.length) return startY;
  var max = rows[0].cost || 1;
  var body = rows.map(function (r) {
    return { name: r.name, cost: money(r.cost), bar: "", _pct: Math.max(0, Math.min(1, r.cost / max)) };
  });

  autoTable(doc, {
    startY: startY,
    margin: { top: 68, bottom: 60, left: MARGIN, right: MARGIN },
    head: [
      [{ content: title, colSpan: 3, styles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold", fontSize: 11, halign: "left", cellPadding: 6 } }],
      [
        { content: "Naam", styles: { fillColor: INK_DIM, textColor: WHITE, fontSize: 8, fontStyle: "normal" } },
        { content: "Kosten", styles: { fillColor: INK_DIM, textColor: WHITE, fontSize: 8, fontStyle: "normal", halign: "right" } },
        { content: "", styles: { fillColor: INK_DIM, textColor: WHITE, fontSize: 8, fontStyle: "normal" } }
      ]
    ],
    body: body,
    columns: [
      { header: "Naam", dataKey: "name" },
      { header: "Kosten", dataKey: "cost" },
      { header: "", dataKey: "bar" }
    ],
    theme: "striped",
    styles: { font: "helvetica", fontSize: 9, textColor: INK, lineColor: LINE, cellPadding: 5 },
    alternateRowStyles: { fillColor: PANEL },
    columnStyles: {
      name: { cellWidth: "auto" },
      cost: { halign: "right", cellWidth: 90 },
      bar: { cellWidth: 60, cellPadding: 0 }
    },
    didDrawCell: function (data) {
      if (data.column.dataKey === "bar" && data.section === "body") {
        var pct = data.row.raw._pct;
        setFillRGB(doc, BLUE);
        doc.roundedRect(data.cell.x + 4, data.cell.y + data.cell.height / 2 - 3, Math.max(2, (data.cell.width - 8) * pct), 6, 1.5, 1.5, "F");
      }
    },
    // Fires for every page this table's content actually starts/continues on, including a
    // page it jumps to before drawing a single row if it wouldn't otherwise fit — the one
    // hook that reliably covers that case. ensureChromeForPage is itself idempotent per page
    // number, so this is safe to fire even for a page this function already chromed manually.
    // NOTE: data.pageNumber is autotable's own table-relative page counter (verified against
    // jspdf-autotable's source — HookData sets it from table.pageNumber, which resets per
    // table), not the document's absolute page — using it here would collide across tables
    // and silently skip chrome on real new pages. doc.getCurrentPageInfo() is the ground truth.
    willDrawPage: function () {
      ensureChromeForPage(doc.getCurrentPageInfo().pageNumber);
    }
  });

  return doc.lastAutoTable.finalY + 20;
}

/**
 * @param {object} m - the model returned by buildModel() in scan.js
 * @param {string[]} fileNames - source file names (or the synthetic sample label)
 * @param {boolean} isSample - true for the synthetic demo-mode report
 * @returns {Promise<Blob>}
 */
export async function buildReportPDF(m, fileNames, isSample) {
  var money = makeMoney(m.currency === "MIXED" ? "" : m.currency);
  var sections = buildSignals(m, money);
  var doc = new jsPDF({ unit: "pt", format: "a4" });

  var meta = {
    stamp: m.generatedAt.toLocaleString("nl-NL"),
    // Truncate individual names, not just the joined line: a single long, space-free
    // filename is one unbreakable "word" for splitTextToSize's word-wrap, which still
    // wraps it but looks worse than a clean ellipsis.
    fileNames: fileNames.map(function (n) { return n.length > 40 ? n.slice(0, 39) + "…" : n; }).join(", "),
    period: periodText(m)
  };

  // Idempotent per page number: safe to call from the initial manual draw, from drawSignals'
  // own page-break handling, and from every autoTable's willDrawPage hook, regardless of
  // which of those actually ends up triggering a given page first.
  var chromedPages = {};
  function ensureChromeForPage(pageNumber) {
    if (chromedPages[pageNumber]) return;
    chromedPages[pageNumber] = true;
    drawPageChrome(doc, { big: pageNumber === 1, isSample: isSample, meta: meta });
  }

  ensureChromeForPage(1);
  var y = 108;

  var kpiTiles = [
    { val: money(m.total), lbl: "Totale uitgaven" },
    { val: periodText(m), lbl: "Periode" },
    { val: String(m.categoryCount), lbl: "Categorieën" },
    m.hasCoverage
      ? { val: Math.round(m.onDemandShare * 100) + "%", lbl: "On-demand" }
      : { val: String(m.hasGroups ? m.groupCount : m.rowCount), lbl: m.hasGroups ? "Resourcegroepen" : "Regels" }
  ];
  if (m.hasTags) kpiTiles.push({ val: Math.round(m.untaggedShare * 100) + "%", lbl: "Zonder tags" });

  y = drawKpiStrip(doc, kpiTiles, MARGIN, y, CONTENT_W) + 24;

  y = drawSignals(doc, sections, MARGIN, y, CONTENT_W, function () {
    doc.addPage();
    var pn = doc.getCurrentPageInfo().pageNumber;
    ensureChromeForPage(pn);
    return 68;
  });
  y += 8;

  if (m.hasMonths && m.months.length >= 2) {
    var monthsRows = m.months.map(function (r) { return { name: r.label, cost: r.cost }; });
    y = drawRankedTable(doc, "Verloop per maand", monthsRows, money, y, ensureChromeForPage);
  }
  y = drawRankedTable(doc, "Uitgaven per categorie", m.categories, money, y, ensureChromeForPage);
  if (m.hasResources) y = drawRankedTable(doc, "Duurste resources", m.resources, money, y, ensureChromeForPage);
  if (m.hasSubscriptions) y = drawRankedTable(doc, "Uitgaven per subscription", m.subscriptions, money, y, ensureChromeForPage);
  if (m.hasGroups) y = drawRankedTable(doc, "Uitgaven per resourcegroep", m.groups, money, y, ensureChromeForPage);

  doc.putTotalPages("{totalPages}");
  return doc.output("blob");
}
