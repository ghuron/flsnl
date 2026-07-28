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

  // 1b. Untagged spend — the number worth forwarding to management as-is.
  if (m.hasTags && m.untaggedShare >= 0.3) {
    out.push({ severity: "med", title: "Veel van je rekening heeft geen tags",
      body: Math.round(m.untaggedShare * 100) + "% van je uitgaven (" + money(m.untaggedCost) + ") staat zonder tags. " +
            "Zonder tags kun je kosten niet aan een team of project toewijzen — dat is meestal het eerste dat moet veranderen." });
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
    var movers = (m._catMovers || []).filter(function (x) { return x.delta > 0 && x.delta / (m.total || 1) >= 0.03; });
    if (movers.length) {
      var top = movers[0];
      out.push({ severity: "info", title: "Grootste stijger: " + top.name,
        body: top.name + " groeide van " + money(top.prev) + " naar " + money(top.last) + " (+" + money(top.delta) + "). Waarschijnlijk waar de stijging vandaan komt." });
      var rest = movers.slice(1, 4);
      if (rest.length) {
        out.push({ severity: "info", title: "Andere stijgers",
          body: rest.map(function (x) { return x.name + " (+" + money(x.delta) + ")"; }).join(", ") + "." });
      }
    }
    if (m._newCategories && m._newCategories.length) {
      var fresh = m._newCategories.slice(0, 3);
      out.push({ severity: "info", title: "Nieuw deze maand",
        body: fresh.map(function (x) { return x.name + " (" + money(x.cost) + ")"; }).join(", ") +
              " stond er de maand ervoor nog niet bij." });
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
  if (m.purchaseCost > 0) {
    out.push({ severity: "info", title: "Reserveringsaankopen buiten het totaal gehouden",
      body: money(m.purchaseCost) + " aan eenmalige aankopen van reserveringen of savings plans (chargeType ‘Purchase’) staat niet in de bedragen hierboven — dat is een eenmalige uitgave, geen verbruik, en zou de trend van één maand onterecht laten pieken." });
  }

  if (!out.length) {
    out.push({ severity: "info", title: "Geen opvallende patronen in dit overzicht",
      body: "Op factuurniveau springt er niets uit. Een geverifieerd oordeel vraagt meer dan een factuur: productietoegang, historie en je eigen engineers erbij — dat is de aparte, betaalde stap." });
  }
  return out;
}

function periodText(m) {
  if (!m.hasMonths || !m.months.length) return "—";
  var f = m.months[0].label, l = m.months[m.months.length - 1].label;
  // En dash, not an arrow: shared with the PDF report, whose standard font only supports
  // WinAnsi — an arrow glyph isn't in that encoding and renders as garbage there.
  return f === l ? f : f + " – " + l;
}

export { makeMoney, buildSignals, periodText };
