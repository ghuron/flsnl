// Every user-facing string the scan engine produces at runtime — signal text, KPI/table
// labels, status/error messages, the sample banner, the PDF's own chrome — lives here, in one
// place, per locale. report-data.js, scan.js and pdf/buildReportPDF.js all read from this
// module rather than hardcoding text themselves, so a translation review has exactly one file
// to check and the three consumers can never drift out of sync with each other.
//
// Interpolated entries are functions, not "{placeholder}" template strings: NL and EN put
// numbers and clauses in different places within a sentence, and a positional-placeholder
// scheme would either force the same word order on both or need its own reordering syntax.
// A function can just say things in whatever order the language wants.
"use strict";

var nl = {
  locale: "nl-NL",

  months: ["", "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  monthsJoinTwo: function (a, b) { return a + " + " + b; },
  monthsRange: function (first, last, n) { return first + " – " + last + " · " + n + " maanden"; },
  periodUnknown: "—",
  periodRange: function (a, b) { return a + " – " + b; },

  kpi: {
    total: "Totale uitgaven", period: "Periode", categories: "Categorieën",
    onDemand: "On-demand", groups: "Resourcegroepen", rows: "Regels", untagged: "Zonder tags"
  },
  severity: { high: "Actie", med: "Let op", info: "Ter info" },
  table: {
    name: "Naam", cost: "Kosten",
    months: "Verloop per maand", categories: "Uitgaven per categorie", resources: "Duurste resources",
    subscriptions: "Uitgaven per subscription", groups: "Uitgaven per resourcegroep"
  },

  sample: {
    banner: "Dit is een voorbeeldrapport met verzonnen data — geen echte Azure-kosten.",
    pill: "VOORBEELD",
    sourceLabel: "Voorbeelddata (synthetisch)"
  },

  sections: {
    self: { heading: "Zelf op te lossen",
      intro: "Inkoop en configuratie. Je eigen IT-team kan dit doorvoeren — daar heb je niemand van buiten voor nodig." },
    engineering: { heading: "Vraagt engineering",
      intro: "Dit zit in hoe de applicatie is gebouwd, niet in een instelling. Patronen, geen oordelen: wat het écht kost om te veranderen, blijkt pas met productietoegang en je eigen engineers erbij." },
    clean: { heading: "Geen opvallende patronen" },
    notes: { heading: "Over deze cijfers" }
  },

  // Every function here takes only pre-formatted strings/values, never a formatter function —
  // the caller (buildSignals in report-data.js) always calls money()/pct() itself before
  // invoking one of these. Keeps these purely about assembling text in the right order for
  // the language, with no ambiguity about what type an argument is.
  signals: {
    unusedReservation: function (amountMoney) {
      return { title: "Ongebruikte reserveringen of savings plans",
        body: "Er is " + amountMoney + " aan gereserveerde capaciteit betaald die niet is verbruikt (chargeType ‘Unused…’). " +
              "Dat is geld dat nu weglekt — controleer of de reservering nog past bij wat je draait." };
    },
    untaggedSpend: function (pct, amountMoney) {
      return { title: "Veel van je rekening heeft geen tags",
        body: pct + " van je uitgaven (" + amountMoney + ") staat zonder tags. " +
              "Zonder tags kun je kosten niet aan een team of project toewijzen — dat is meestal het eerste dat moet veranderen." };
    },
    onDemandCoverage: function (pct, amountMoney) {
      return { title: "Vrijwel alles wordt on-demand betaald",
        body: pct + " van je verbruik loopt tegen het on-demand-tarief (" + amountMoney + "). " +
              "Voor wat maand na maand blijft draaien is een reservering of savings plan doorgaans 20–60% goedkoper. " +
              "Kijk wel eerst of het écht altijd moet draaien — je legt een reservering voor één of drie jaar vast." };
    },
    marketplace: function (amountMoney, pct) {
      return { title: "Marketplace-abonnementen lopen door",
        body: amountMoney + " gaat naar software van derden via de Azure Marketplace (" + pct + " van je rekening). " +
              "Gebruikt iemand dit nog? Marketplace-items blijven doorlopen tot iemand ze opzegt." };
    },
    license: function (amountMoney) {
      return { title: "Je betaalt Windows- of SQL-licenties bovenop de rekening",
        body: amountMoney + " zit in meters met een Windows- of SQL-licentiecomponent. " +
              "Heb je die licenties al on-premises met Software Assurance? Dan kan Azure Hybrid Benefit dat deel wegnemen — een instelling per resource, geen migratie." };
    },
    monthTrend: function (up, pctAbs, curLabel, curCostMoney, prevLabel, prevCostMoney) {
      return { title: "Je rekening " + (up ? "stijgt" : "daalt") + " (" + (up ? "+" : "") + pctAbs + "% laatste maand)",
        body: curLabel + " was " + curCostMoney + " tegenover " + prevCostMoney + " in " + prevLabel + ". " +
              (up ? "Kijk welke categorie de stijging veroorzaakt — die staat hieronder." : "Mooi — maar controleer of er niets is uitgezet dat wél nodig was.") };
    },
    biggestMover: function (name, prevMoney, lastMoney, deltaMoney) {
      return { title: "Grootste stijger: " + name,
        body: name + " groeide van " + prevMoney + " naar " + lastMoney + " (+" + deltaMoney + "). Waarschijnlijk waar de stijging vandaan komt." };
    },
    otherMovers: function (list) {
      return { title: "Andere stijgers", body: list.join(", ") + "." };
    },
    newThisMonth: function (list) {
      return { title: "Nieuw deze maand", body: list.join(", ") + " stond er de maand ervoor nog niet bij." };
    },
    concentration: function (pct) {
      return { title: "Je uitgaven zijn geconcentreerd",
        body: "De vijf duurste resources zijn samen " + pct + " van je totale rekening. Dat is waar een optimalisatie het meeste oplevert — begin daar." };
    },
    weekendFlatness: function (pct, dayCount) {
      return { title: "Je rekening kent geen weekend",
        body: "Compute kost op een weekenddag " + pct + " van wat het op een werkdag kost — er zit geen dal in, " + dayCount + " dagen lang. " +
              "Als er in het weekend niemand werkt, betaal je voor capaciteit die staat te wachten. " +
              "Dit is meestal geen verbouwing maar een planning: een start/stop-schema (VM auto-shutdown, scale-to-zero voor Container Apps of App Service) zet precies dit stil. Vraag je Ops- of platformteam of dat al staat ingesteld." };
    },
    alwaysOnNonProd: function (totalMoney, pct, count, examples, perMonthMoney) {
      return { title: "Test- en stage-omgevingen draaien dag en nacht",
        body: totalMoney + " (" + pct + " van je rekening) staat op " + count +
              " resources met test-, stage- of poc-achtige namen die vrijwel elke dag van de periode doorliepen" +
              (examples ? " — bijvoorbeeld " + examples : "") + ". " +
              (perMonthMoney ? "Het compute-deel daarvan is ruwweg " + perMonthMoney + " per maand; alleen tijdens kantooruren draaien (12×5) scheelt daar grofweg twee derde van. " : "") +
              "Wie gebruikt deze omgevingen om drie uur ’s nachts? Azure DevTest Labs regelt start/stop-schema’s en kostenbeleid voor dit soort omgevingen kant-en-klaar, zonder dat je er zelf iets voor hoeft te bouwen." };
    },
    lbConsolidation: function (totalMoney, count, dataPct, isManagedEnv) {
      var body = count + " load balancers (" + totalMoney + ") verwerken samen maar " + dataPct +
        " aan echt dataverkeer — de rest is vaste bandvergoeding, die evengoed doorloopt als er nauwelijks verkeer is. ";
      body += isManagedEnv
        ? "Het merendeel hiervan staat in resourcegroepen die Azure zelf aanmaakt voor een Container Apps-omgeving — daar hoort standaard één load balancer bij elke omgeving. Consolideren betekent hier: minder omgevingen, niet losse load balancers samenvoegen."
        : "Staan de bijbehorende workloads in hetzelfde netwerk, dan kunnen meerdere load balancers vaak op één worden samengevoegd, zolang de gecombineerde belasting onder de capaciteit van één load balancer blijft.";
      return { title: "Meerdere load balancers, elk nauwelijks belast", body: body };
    },
    egress: function (egressMoney, computeMoney, pct) {
      return { title: "Veel uitgaand dataverkeer ten opzichte van compute",
        body: egressMoney + " aan uitgaand verkeer tegenover " + computeMoney + " aan compute (" + pct + "). " +
              "Dat wijst meestal op data die heen en weer gaat tussen regio's of naar buiten toe — caching, een CDN of een andere plaatsing van de data zijn ontwerpkeuzes, geen instellingen." };
    },
    iaasHeavy: function (pct) {
      return { title: "Je betaalt vooral voor machines, niet voor diensten",
        body: pct + " van je rekening gaat naar virtuele machines, schijven en netwerk — infrastructuur die je zelf draaiende houdt. " +
              "Dat is het patroon van een omgeving die één op één naar de cloud is verhuisd. Beheerde diensten schalen mee en vragen geen onderhoud, maar dat vraagt een verbouwing, geen knop." };
    },
    creditsNote: function (amountMoney) {
      return { title: "Credits en correcties zijn meegerekend",
        body: "Het bestand bevat " + amountMoney + " aan afrondingen, kortingen of terugboekingen (chargeType ‘Refund’/‘RoundingAdjustment’). Die zitten in het totaal." };
    },
    mixedCurrencies: function (list) {
      return { title: "Meerdere valuta in één set",
        body: "De bestanden bevatten bedragen in " + list + ". Het totaal telt de ruwe bedragen op zonder om te rekenen — houd daar rekening mee." };
    },
    purchasesExcluded: function (amountMoney) {
      return { title: "Reserveringsaankopen buiten het totaal gehouden",
        body: amountMoney + " aan eenmalige aankopen van reserveringen of savings plans (chargeType ‘Purchase’) staat niet in de bedragen hierboven — dat is een eenmalige uitgave, geen verbruik, en zou de trend van één maand onterecht laten pieken." };
    },
    noDailyData: function () {
      return { title: "Dit bestand heeft geen dagelijkse detaillering",
        body: "Daardoor kunnen we niet zien of je verbruik het weekend en de nacht volgt — meestal de interessantste vraag. " +
              "Exporteer je verbruik met dagelijkse granulariteit en draai de scan opnieuw; het bestand is groter, maar het antwoord is scherper." };
    },
    clean: function () {
      return { title: "Op factuurniveau springt er niets uit",
        body: "Dat is een compliment: commercieel zit het strak. Een geverifieerd oordeel vraagt meer dan een factuur — productietoegang, historie en je eigen engineers erbij. Dat is de aparte, betaalde stap." };
    },
    noEngineeringOpportunity: function () {
      return { title: "Geen kans voor herbouw gevonden",
        body: "Op basis van deze factuurgegevens ziet First Line Software geen aannemelijke kans om kosten te besparen via herbouw. Zie jij die wel? Mail az@fls.dev voor een gratis gesprek van 30 minuten." };
    }
  },

  status: {
    chooseFiles: "Kies .csv-bestanden.",
    removeFile: "Verwijder",
    reading: function (name) { return "‘" + name + "’ lezen…"; },
    readingProgress: function (name, n) { return "‘" + name + "’ lezen… (" + n.toLocaleString("nl-NL") + " regels)"; },
    readingLarge: "bezig met lezen… (groot bestand, kan even duren)",
    readingPlain: "bezig met lezen…",
    noRows: "geen leesbare rijen",
    unreadable: "kon niet gelezen worden",
    noMonthRecognised: "geen maand herkend",
    filesReadyToAnalyze: function (n) { return n + " bestand(en) klaar om te analyseren."; },
    noUsableFiles: "Geen bruikbare bestanden.",
    filesReady: function (n) { return n + " bestand(en) klaar."; },
    noUsableRows: "Kon geen bruikbare rijen lezen. Is dit een Azure-verbruiks-CSV?",
    noCostColumnDelim: "Geen kostenkolom gevonden — het bestand lijkt niet op komma's of puntkomma's gesplitst te zijn. Is dit een onbewerkte Azure-export?",
    noCostColumn: "Geen kostenkolom gevonden. Verwacht een kolom zoals ‘CostInBillingCurrency’ of ‘Cost’.",
    analyzingSample: "Voorbeeld analyseren…",
    analyzing: "Analyseren…",
    noCostRows: "Geen kostenregels gevonden in het bestand.",
    sampleDone: function (rows, files) { return "Voorbeeld klaar — " + rows.toLocaleString("nl-NL") + " regels uit " + files + " bestand(en) verwerkt."; },
    analysisDone: function (rows, files) { return "Analyse klaar — " + rows.toLocaleString("nl-NL") + " regels uit " + files + " bestand(en) verwerkt."; },
    generatingPdf: "PDF genereren…",
    pdfModuleFailed: "PDF-module kon niet laden. Controleer je verbinding en probeer opnieuw, of ververs de pagina.",
    pdfError: "Er ging iets mis bij het maken van de PDF.",
    sampleReportError: "Er ging iets mis bij het maken van het voorbeeldrapport.",
    popupBlocked: "Kon het voorbeeldrapport niet in een nieuw tabblad openen — check of pop-ups geblokkeerd worden.",
    scannerLoadFailed: "De scanner kon niet laden. Ververs de pagina en probeer opnieuw."
  },

  pdf: {
    title: "Azure Waste Scan — rapport",
    generatedLine: function (stamp, files, period) { return "Gegenereerd op " + stamp + " · Bron: " + files + " · Periode: " + period; },
    disclaimer: "Dit rapport is volledig in de browser gegenereerd; er is geen data verzonden. De patronen zijn compleet en van jou. " +
      "Een geverifieerd oordeel vraagt productietoegang, meer historie dan een factuur laat zien, en je eigen engineers erbij — een aparte, betaalde stap.",
    pageOf: function (n) { return "Pagina " + n + " van "; }, // "{totalPages}" is appended by the caller — see buildReportPDF.js
    overview: {
      title: "Overzicht", other: "Overig", pctHeader: "%",
      aiSpend: function (amountMoney, pct) { return "AI-uitgaven: " + amountMoney + " (" + pct + ")"; }
    }
  }
};

var en = {
  locale: "en-US",

  months: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  monthsJoinTwo: function (a, b) { return a + " + " + b; },
  monthsRange: function (first, last, n) { return first + " – " + last + " · " + n + " months"; },
  periodUnknown: "—",
  periodRange: function (a, b) { return a + " – " + b; },

  kpi: {
    total: "Total spend", period: "Period", categories: "Categories",
    onDemand: "On-demand", groups: "Resource groups", rows: "Rows", untagged: "Untagged"
  },
  severity: { high: "Action", med: "Watch", info: "Info" },
  table: {
    name: "Name", cost: "Cost",
    months: "Month by month", categories: "Spend by category", resources: "Priciest resources",
    subscriptions: "Spend by subscription", groups: "Spend by resource group"
  },

  sample: {
    banner: "This is a sample report with made-up data — not real Azure costs.",
    pill: "SAMPLE",
    sourceLabel: "Sample data (synthetic)"
  },

  sections: {
    self: { heading: "Self-service",
      intro: "Procurement and configuration. Your own IT team can act on this — you don't need anyone from outside for it." },
    engineering: { heading: "Needs engineering",
      intro: "This is baked into how the application is built, not a setting. Patterns, not verdicts: what it actually costs to change only becomes clear with production access and your own engineers in the room." },
    clean: { heading: "Nothing stands out" },
    notes: { heading: "About these numbers" }
  },

  // Same convention as the Dutch table above: pre-formatted strings only, never a formatter.
  signals: {
    unusedReservation: function (amountMoney) {
      return { title: "Unused reservations or savings plans",
        body: "You've paid for " + amountMoney + " of reserved capacity that went unused (chargeType ‘Unused…’). " +
              "That's money leaking right now — check whether the reservation still matches what you're running." };
    },
    untaggedSpend: function (pct, amountMoney) {
      return { title: "A lot of your bill has no tags",
        body: pct + " of your spend (" + amountMoney + ") has no tags. " +
              "Without tags you can't attribute cost to a team or project — that's usually the first thing to fix." };
    },
    onDemandCoverage: function (pct, amountMoney) {
      return { title: "Almost everything is billed on-demand",
        body: pct + " of your usage runs at the on-demand rate (" + amountMoney + "). " +
              "For anything that keeps running month after month, a reservation or savings plan is usually 20–60% cheaper. " +
              "Check first whether it genuinely needs to run all the time, though — a reservation locks you in for one or three years." };
    },
    marketplace: function (amountMoney, pct) {
      return { title: "Marketplace subscriptions keep running",
        body: amountMoney + " goes to third-party software through the Azure Marketplace (" + pct + " of your bill). " +
              "Is anyone still using this? Marketplace items keep billing until someone cancels them." };
    },
    license: function (amountMoney) {
      return { title: "You're paying Windows or SQL licensing on top of the bill",
        body: amountMoney + " sits in meters with a Windows or SQL licensing component. " +
              "Already own those licenses on-premises with Software Assurance? Azure Hybrid Benefit can remove that part — a setting per resource, not a migration." };
    },
    monthTrend: function (up, pctAbs, curLabel, curCostMoney, prevLabel, prevCostMoney) {
      return { title: "Your bill is " + (up ? "rising" : "falling") + " (" + (up ? "+" : "") + pctAbs + "% last month)",
        body: curLabel + " was " + curCostMoney + " against " + prevCostMoney + " in " + prevLabel + ". " +
              (up ? "See which category is driving the rise — it's listed below." : "Good — but check nothing got switched off that was actually needed.") };
    },
    biggestMover: function (name, prevMoney, lastMoney, deltaMoney) {
      return { title: "Biggest mover: " + name,
        body: name + " grew from " + prevMoney + " to " + lastMoney + " (+" + deltaMoney + "). Probably where the rise is coming from." };
    },
    otherMovers: function (list) {
      return { title: "Other risers", body: list.join(", ") + "." };
    },
    newThisMonth: function (list) {
      return { title: "New this month", body: list.join(", ") + " wasn't there the month before." };
    },
    concentration: function (pct) {
      return { title: "Your spend is concentrated",
        body: "The five priciest resources together are " + pct + " of your total bill. That's where optimisation pays off most — start there." };
    },
    weekendFlatness: function (pct, dayCount) {
      return { title: "Your bill doesn't know it's the weekend",
        body: "Compute costs " + pct + " on a weekend day of what it costs on a weekday — no dip at all, across " + dayCount + " days. " +
              "If nobody's working over the weekend, you're paying for capacity that's sitting idle. " +
              "This is usually a scheduling job, not a rebuild: a start/stop schedule (VM auto-shutdown, scale-to-zero for Container Apps or App Service) turns exactly this off. Ask your Ops or platform team whether that's already set up." };
    },
    alwaysOnNonProd: function (totalMoney, pct, count, examples, perMonthMoney) {
      return { title: "Test and staging environments run around the clock",
        body: totalMoney + " (" + pct + " of your bill) sits on " + count +
              " resources with test-, stage- or poc-shaped names that ran on nearly every day of the period" +
              (examples ? " — for example " + examples : "") + ". " +
              (perMonthMoney ? "The compute portion of that is roughly " + perMonthMoney + " a month; running office-hours only (12×5) would cut that by roughly two thirds. " : "") +
              "Who's using these environments at three in the morning? Azure DevTest Labs handles start/stop schedules and cost policies for exactly this kind of environment out of the box, with nothing to build yourself." };
    },
    lbConsolidation: function (totalMoney, count, dataPct, isManagedEnv) {
      var body = count + " load balancers (" + totalMoney + ") together process only " + dataPct +
        " of real data traffic — the rest is the flat base fee, which bills the same whether there's real traffic or not. ";
      body += isManagedEnv
        ? "Most of these sit in resource groups Azure creates automatically for a Container Apps environment — one load balancer comes bundled with every environment by default. Consolidating here means fewer environments, not merging load balancers directly."
        : "If the workloads behind them share a network, multiple load balancers can often be merged onto one, as long as the combined load stays under a single load balancer's capacity.";
      return { title: "Multiple load balancers, each barely loaded", body: body };
    },
    egress: function (egressMoney, computeMoney, pct) {
      return { title: "A lot of outbound data transfer relative to compute",
        body: egressMoney + " of outbound traffic against " + computeMoney + " of compute (" + pct + "). " +
              "That usually points to data moving between regions or out to the internet — caching, a CDN or a different data placement are design decisions, not settings." };
    },
    iaasHeavy: function (pct) {
      return { title: "You're mostly paying for machines, not services",
        body: pct + " of your bill goes to virtual machines, disks and networking — infrastructure you keep running yourself. " +
              "That's the pattern of an environment lifted straight into the cloud. Managed services scale themselves and need no upkeep, but that takes a rebuild, not a switch." };
    },
    creditsNote: function (amountMoney) {
      return { title: "Credits and corrections are included",
        body: "The file contains " + amountMoney + " of rounding, discounts or reversals (chargeType ‘Refund’/‘RoundingAdjustment’). Those are included in the total." };
    },
    mixedCurrencies: function (list) {
      return { title: "Multiple currencies in one set",
        body: "The files contain amounts in " + list + ". The total simply adds up the raw amounts without converting — keep that in mind." };
    },
    purchasesExcluded: function (amountMoney) {
      return { title: "Reservation purchases kept out of the total",
        body: amountMoney + " of one-time reservation or savings-plan purchases (chargeType ‘Purchase’) is not included in the figures above — that's a one-time outlay, not usage, and would falsely spike a single month's trend." };
    },
    noDailyData: function () {
      return { title: "This file has no daily detail",
        body: "That means we can't see whether your usage follows the weekend and the night — usually the most interesting question. " +
              "Export with daily granularity and run the scan again; the file is bigger, but the answer is sharper." };
    },
    clean: function () {
      return { title: "Nothing stands out at the billing level",
        body: "That's a compliment: commercially, this is tight. A verified verdict needs more than a bill — production access, history, and your own engineers in the room. That's the separate, paid step." };
    },
    noEngineeringOpportunity: function () {
      return { title: "No re-engineering opportunity found",
        body: "Based on this billing data, First Line Software doesn't see a plausible opportunity to cut costs through re-engineering. If you do see one, email az@fls.dev to schedule a free 30-minute call." };
    }
  },

  status: {
    chooseFiles: "Choose .csv files.",
    removeFile: "Remove",
    reading: function (name) { return "Reading ‘" + name + "’…"; },
    readingProgress: function (name, n) { return "Reading ‘" + name + "’… (" + n.toLocaleString("en-US") + " rows)"; },
    readingLarge: "reading… (large file, may take a moment)",
    readingPlain: "reading…",
    noRows: "no readable rows",
    unreadable: "couldn't be read",
    noMonthRecognised: "no month recognised",
    filesReadyToAnalyze: function (n) { return n + " file(s) ready to analyze."; },
    noUsableFiles: "No usable files.",
    filesReady: function (n) { return n + " file(s) ready."; },
    noUsableRows: "Couldn't read any usable rows. Is this an Azure usage CSV?",
    noCostColumnDelim: "No cost column found — the file doesn't seem to be split on commas or semicolons. Is this an unmodified Azure export?",
    noCostColumn: "No cost column found. Expected a column like ‘CostInBillingCurrency’ or ‘Cost’.",
    analyzingSample: "Analyzing sample…",
    analyzing: "Analyzing…",
    noCostRows: "No cost rows found in the file.",
    sampleDone: function (rows, files) { return "Sample ready — " + rows.toLocaleString("en-US") + " rows from " + files + " file(s) processed."; },
    analysisDone: function (rows, files) { return "Analysis done — " + rows.toLocaleString("en-US") + " rows from " + files + " file(s) processed."; },
    generatingPdf: "Generating PDF…",
    pdfModuleFailed: "The PDF module couldn't load. Check your connection and try again, or refresh the page.",
    pdfError: "Something went wrong generating the PDF.",
    sampleReportError: "Something went wrong generating the sample report.",
    popupBlocked: "Couldn't open the sample report in a new tab — check whether pop-ups are blocked.",
    scannerLoadFailed: "The scanner couldn't load. Refresh the page and try again."
  },

  pdf: {
    title: "Azure Waste Scan — report",
    generatedLine: function (stamp, files, period) { return "Generated on " + stamp + " · Source: " + files + " · Period: " + period; },
    disclaimer: "This report was generated entirely in the browser; no data was sent anywhere. The patterns are complete, and yours. " +
      "A verified verdict needs more than a bill — production access, more history than a bill shows, and your own engineers in the room. That's the separate, paid step.",
    pageOf: function (n) { return "Page " + n + " of "; },
    overview: {
      title: "Overview", other: "Other", pctHeader: "%",
      aiSpend: function (amountMoney, pct) { return "AI spend: " + amountMoney + " (" + pct + ")"; }
    }
  }
};

var STR = { nl: nl, en: en };

// Falls back to nl for an unknown/missing locale rather than throwing, so a stray or future
// locale code degrades to the default language instead of crashing the scan.
function textFor(lang) {
  return STR[lang] || STR.nl;
}

export { STR, textFor };
