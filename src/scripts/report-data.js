// Shared between the on-screen report (scan.js's renderResults) and the downloadable PDF
// (pdf/buildReportPDF.js), so both ever compute the same numbers and the same wording from
// one place. No DOM/jsPDF dependency here — pure data-in, string/function-out.
"use strict";

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

// Honest signals, phrased as questions/observations rather than verdicts. Each is only
// emitted when the underlying columns are present in the data.
//
// Returns sections rather than one flat list, because the split is the point: what your own
// team can settle with a setting, versus what is baked into how the application is built.
// The second kind is what a bill can only ever raise as a question — and what the paid study
// exists to answer. Both renderers (on-screen and PDF) walk the same structure.
function buildSignals(m, money) {
  var self = [], engineering = [], notes = [];
  var pct = function (x) { return Math.round(x * 100) + "%"; };

  /* ---------------------------------------------- what your own team can settle */

  // Unused reservations / savings plans — literally paid-for, unconsumed commitment.
  if (m.unusedCommitment > 0) {
    self.push({ severity: "high", title: "Ongebruikte reserveringen of savings plans",
      body: "Er is " + money(m.unusedCommitment) + " aan gereserveerde capaciteit betaald die niet is verbruikt (chargeType ‘Unused…’). " +
            "Dat is geld dat nu weglekt — controleer of de reservering nog past bij wat je draait." });
  }

  // Untagged spend — the number worth forwarding to management as-is.
  if (m.hasTags && m.untaggedShare >= 0.3) {
    self.push({ severity: "med", title: "Veel van je rekening heeft geen tags",
      body: pct(m.untaggedShare) + " van je uitgaven (" + money(m.untaggedCost) + ") staat zonder tags. " +
            "Zonder tags kun je kosten niet aan een team of project toewijzen — dat is meestal het eerste dat moet veranderen." });
  }

  // Reservation/savings coverage. The second sentence is deliberate: buying a three-year
  // reservation for something that shouldn't run at all locks the waste in instead of fixing
  // it, so the cheap win and the structural question get named together.
  if (m.hasCoverage && m.onDemandShare >= 0.85 && m.onDemandCost / (m.total || 1) >= 0.3) {
    self.push({ severity: "med", title: "Vrijwel alles wordt on-demand betaald",
      body: pct(m.onDemandShare) + " van je verbruik loopt tegen het on-demand-tarief (" + money(m.onDemandCost) + "). " +
            "Voor wat maand na maand blijft draaien is een reservering of savings plan doorgaans 20–60% goedkoper. " +
            "Kijk wel eerst of het écht altijd moet draaien — je legt een reservering voor één of drie jaar vast." });
  }

  // Marketplace subscriptions: third-party software billed through Azure, easy to forget.
  if (m.marketplaceCost > 0 && m.marketplaceCost / (m.total || 1) >= 0.02) {
    self.push({ severity: "info", title: "Marketplace-abonnementen lopen door",
      body: money(m.marketplaceCost) + " gaat naar software van derden via de Azure Marketplace (" + pct(m.marketplaceCost / m.total) + " van je rekening). " +
            "Gebruikt iemand dit nog? Marketplace-items blijven doorlopen tot iemand ze opzegt." });
  }

  // Windows/SQL licence surcharge — Hybrid Benefit candidate if the licences are already owned.
  if (m.licenseCost > 0 && m.licenseCost / (m.total || 1) >= 0.03) {
    self.push({ severity: "info", title: "Je betaalt Windows- of SQL-licenties bovenop de rekening",
      body: money(m.licenseCost) + " zit in meters met een Windows- of SQL-licentiecomponent. " +
            "Heb je die licenties al on-premises met Software Assurance? Dan kan Azure Hybrid Benefit dat deel wegnemen — een instelling per resource, geen migratie." });
  }

  // Month-over-month trend.
  if (m.hasMonths && m.months.length >= 2) {
    var a = m.months[m.months.length - 2], b = m.months[m.months.length - 1];
    if (a.cost > 0) {
      var delta = (b.cost - a.cost) / a.cost;
      if (Math.abs(delta) >= 0.1) {
        self.push({ severity: delta > 0 ? "med" : "info",
          title: "Je rekening " + (delta > 0 ? "stijgt" : "daalt") + " (" + (delta > 0 ? "+" : "") + Math.round(delta * 100) + "% laatste maand)",
          body: b.label + " was " + money(b.cost) + " tegenover " + money(a.cost) + " in " + a.label + ". " +
                (delta > 0 ? "Kijk welke categorie de stijging veroorzaakt — die staat hieronder." : "Mooi — maar controleer of er niets is uitgezet dat wél nodig was.") });
      }
    }
    var movers = (m._catMovers || []).filter(function (x) { return x.delta > 0 && x.delta / (m.total || 1) >= 0.03; });
    if (movers.length) {
      var top = movers[0];
      self.push({ severity: "info", title: "Grootste stijger: " + top.name,
        body: top.name + " groeide van " + money(top.prev) + " naar " + money(top.last) + " (+" + money(top.delta) + "). Waarschijnlijk waar de stijging vandaan komt." });
      var rest = movers.slice(1, 4);
      if (rest.length) {
        self.push({ severity: "info", title: "Andere stijgers",
          body: rest.map(function (x) { return x.name + " (+" + money(x.delta) + ")"; }).join(", ") + "." });
      }
    }
    if (m._newCategories && m._newCategories.length) {
      var fresh = m._newCategories.slice(0, 3);
      self.push({ severity: "info", title: "Nieuw deze maand",
        body: fresh.map(function (x) { return x.name + " (" + money(x.cost) + ")"; }).join(", ") +
              " stond er de maand ervoor nog niet bij." });
    }
  }

  // Concentration — where any optimisation pays off most.
  if (m.hasResources && m.concentrationTop5 >= 0.4 && m.resourceCount > 5) {
    self.push({ severity: "info", title: "Je uitgaven zijn geconcentreerd",
      body: "De vijf duurste resources zijn samen " + pct(m.concentrationTop5) +
            " van je totale rekening. Dat is waar een optimalisatie het meeste oplevert — begin daar." });
  }

  /* ------------------------------------------------------- what engineering asks */

  // Weekend flatness. The clearest thing a bill can say about whether a workload follows
  // demand at all: if Sunday costs what Tuesday costs, nothing is scaling down.
  if (m.weekendRatio !== null && m.weekendRatio >= 0.9 && m.computeShare >= 0.15) {
    // Stated as a ratio, not as two amounts: money() rounds to whole units, and two nearly
    // identical averages would print as different figures — the opposite of the point.
    engineering.push({ severity: "high", title: "Je rekening kent geen weekend",
      body: "Compute kost op een weekenddag " + pct(m.weekendRatio) + " van wat het op een werkdag kost — er zit geen dal in, " +
            m.dayCount + " dagen lang. Als er in het weekend niemand werkt, betaal je voor capaciteit die staat te wachten. " +
            "Meeschalen met de vraag is geen instelling die je aanzet; dat zit in hoe de applicatie is gebouwd." });
  }

  // Non-production environments that never stop. Office-hours arithmetic is applied only to
  // the compute part and the assumption is stated, because storage attached to a stopped
  // environment keeps costing the same.
  if (m.nonProdCount > 0 && m.nonProdCost / (m.total || 1) >= 0.05) {
    var perMonth = m.monthsCovered > 0 ? m.nonProdSchedulable / m.monthsCovered : 0;
    var examples = (m.nonProdExamples || []).map(function (e) { return e.name; }).join(", ");
    engineering.push({ severity: "high", title: "Test- en stage-omgevingen draaien dag en nacht",
      body: money(m.nonProdCost) + " (" + pct(m.nonProdCost / m.total) + " van je rekening) staat op " + m.nonProdCount +
            " resources met test-, stage- of poc-achtige namen die vrijwel elke dag van de periode doorliepen" +
            (examples ? " — bijvoorbeeld " + examples : "") + ". " +
            (perMonth > 0
              ? "Het compute-deel daarvan is ruwweg " + money(perMonth) + " per maand; alleen tijdens kantooruren draaien (12×5) scheelt daar grofweg twee derde van. "
              : "") +
            "Wie gebruikt deze omgevingen om drie uur 's nachts?" });
  }

  // Egress relative to compute — a topology question, not a price question.
  if (m.egressCost > 0 && m.computeCost > 0 && m.egressCost / m.computeCost >= 0.1) {
    engineering.push({ severity: "med", title: "Veel uitgaand dataverkeer ten opzichte van compute",
      body: money(m.egressCost) + " aan uitgaand verkeer tegenover " + money(m.computeCost) + " aan compute (" + pct(m.egressCost / m.computeCost) + "). " +
            "Dat wijst meestal op data die heen en weer gaat tussen regio's of naar buiten toe — caching, een CDN of een andere plaatsing van de data zijn ontwerpkeuzes, geen instellingen." });
  }

  // AI spend, the wedge. Reported as a panel even when small, because the shape of it
  // (model mix, no batch meters, GPU always on) is what the follow-up conversation needs.
  if (m.aiCost > 0) {
    var aiNames = (m.aiCategories || []).slice(0, 3).map(function (c) { return c.name; }).join(", ");
    var aiBody = money(m.aiCost) + " (" + pct(m.aiCost / m.total) + " van je rekening) gaat naar " + aiNames + ". ";
    if (m.gpuCost > 0) aiBody += "Daarvan draait " + money(m.gpuCost) + " op GPU-machines. ";
    // The prompt:completion ratio is the one number that says how a model is being used
    // rather than how much it costs. Stated as an observation — a coding-agent workload is
    // legitimately context-heavy, so the ratio raises a question, it does not settle one.
    if (m.aiInputRatio !== null) {
      aiBody += "Voor elke token die een model teruggeeft, stuur je er ongeveer " +
        Math.round(m.aiInputRatio).toLocaleString("nl-NL") + " in";
      if (m.aiCachedShare !== null) {
        aiBody += ", waarvan " + pct(m.aiCachedShare) + " uit cache komt";
      }
      aiBody += ". ";
    }
    aiBody += "Wat een AI-workload kost, zit vooral in hoe hij is gebouwd: contextlengte, caching, batching en modelkeuze schelen makkelijk een factor. " +
      "Dat is precies het soort vraag dat een factuur zelf niet beantwoordt.";
    engineering.push({ severity: m.aiCost / (m.total || 1) >= 0.1 ? "med" : "info",
      title: "AI-uitgaven in beeld", body: aiBody });
  }

  // Lift-and-shift fingerprint.
  if (m.iaasShare >= 0.6 && m.total > 0) {
    engineering.push({ severity: "med", title: "Je betaalt vooral voor machines, niet voor diensten",
      body: pct(m.iaasShare) + " van je rekening gaat naar virtuele machines, schijven en netwerk — infrastructuur die je zelf draaiende houdt. " +
            "Dat is het patroon van een omgeving die één op één naar de cloud is verhuisd. Beheerde diensten schalen mee en vragen geen onderhoud, maar dat vraagt een verbouwing, geen knop." });
  }

  /* ------------------------------------------------------------- about the numbers */

  // Materiality guard: a few cents of rounding is not worth a line in the report.
  if (m.creditsTotal !== 0 && Math.abs(m.creditsTotal) / (m.total || 1) >= 0.005) {
    notes.push({ severity: "info", title: "Credits en correcties zijn meegerekend",
      body: "Het bestand bevat " + money(m.creditsTotal) + " aan afrondingen, kortingen of terugboekingen (chargeType ‘Refund’/‘RoundingAdjustment’). Die zitten in het totaal." });
  }
  if (m.currencies.length > 1) {
    notes.push({ severity: "med", title: "Meerdere valuta in één set",
      body: "De bestanden bevatten bedragen in " + m.currencies.join(", ") + ". Het totaal telt de ruwe bedragen op zonder om te rekenen — houd daar rekening mee." });
  }
  if (m.purchaseCost > 0) {
    notes.push({ severity: "info", title: "Reserveringsaankopen buiten het totaal gehouden",
      body: money(m.purchaseCost) + " aan eenmalige aankopen van reserveringen of savings plans (chargeType ‘Purchase’) staat niet in de bedragen hierboven — dat is een eenmalige uitgave, geen verbruik, en zou de trend van één maand onterecht laten pieken." });
  }
  // Without day-level rows the two strongest engineering signals cannot be computed at all.
  if (!m.hasDaily && m.hasMonths) {
    notes.push({ severity: "info", title: "Dit bestand heeft geen dagelijkse detaillering",
      body: "Daardoor kunnen we niet zien of je verbruik het weekend en de nacht volgt — meestal de interessantste vraag. " +
            "Exporteer je verbruik met dagelijkse granulariteit en draai de scan opnieuw; het bestand is groter, maar het antwoord is scherper." });
  }

  var sections = [];
  if (self.length) {
    sections.push({ key: "self", heading: "Zelf op te lossen",
      intro: "Inkoop en configuratie. Je eigen IT-team kan dit doorvoeren — daar heb je niemand van buiten voor nodig.",
      items: self });
  }
  if (engineering.length) {
    sections.push({ key: "engineering", heading: "Vraagt engineering",
      intro: "Dit zit in hoe de applicatie is gebouwd, niet in een instelling. Patronen, geen oordelen: wat het écht kost om te veranderen, blijkt pas met productietoegang en je eigen engineers erbij.",
      items: engineering });
  }
  if (!sections.length) {
    sections.push({ key: "clean", heading: "Geen opvallende patronen", intro: "",
      items: [{ severity: "info", title: "Op factuurniveau springt er niets uit",
        body: "Dat is een compliment: commercieel zit het strak. Een geverifieerd oordeel vraagt meer dan een factuur — productietoegang, historie en je eigen engineers erbij. Dat is de aparte, betaalde stap." }] });
  }
  if (notes.length) {
    sections.push({ key: "notes", heading: "Over deze cijfers", intro: "", items: notes });
  }
  return sections;
}

function periodText(m) {
  if (!m.hasMonths || !m.months.length) return "—";
  var f = m.months[0].label, l = m.months[m.months.length - 1].label;
  // En dash, not an arrow: shared with the PDF report, whose standard font only supports
  // WinAnsi — an arrow glyph isn't in that encoding and renders as garbage there.
  return f === l ? f : f + " – " + l;
}

export { makeMoney, buildSignals, periodText };
