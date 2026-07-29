// Synthetic Azure usage export, shaped like a real Cost Management CSV, used only by the
// "sample report" button (scan.js) so a first-time visitor can see a populated report with
// zero effort. None of it is real Azure billing data.
//
// Generated at runtime rather than checked in as a literal: the detectors that matter most
// (weekend flatness, always-on non-production) need day-level rows across whole months, and
// three months of daily lines for a dozen resources is ~1,200 rows — a large string to ship
// in the scan chunk when a few dozen lines of generator produce it on demand. The output is
// still handed to the real parseCSV/detectColumns pipeline, so a parsing regression breaks
// the demo exactly as it would break a real scan.
//
// Deterministic by construction — no randomness — so the sample report is identical on every
// visit and can be talked about. Shaped to exercise: flat weekend compute, non-production
// environments that never stop, an unused reservation, untagged spend, a month-over-month
// rise, near-total on-demand pricing, and an AI panel with a prompt-heavy token ratio.
"use strict";

var HEADER = [
  "date", "subscriptionName", "resourceGroupName", "resourceId", "meterCategory", "meterName",
  "meterSubCategory", "chargeType", "pricingModel", "publisherType", "quantity", "unitOfMeasure",
  "costInBillingCurrency", "billingCurrency", "tags"
];

// name, resourceGroup, meterCategory, meterName, baseDailyCost, tags
var RESOURCES = [
  ["vm-prod-web-01", "rg-prod", "Virtual Machines", "D4s v5 Compute Hours", 6.2, "{\"env\":\"prod\",\"team\":\"web\"}"],
  ["vm-prod-api-01", "rg-prod", "Virtual Machines", "D4s v5 Compute Hours", 5.8, "{\"env\":\"prod\",\"team\":\"api\"}"],
  ["aca-shop-frontend", "rg-prod", "Azure Container Apps", "Standard vCPU Active Usage", 4.1, "{\"env\":\"prod\",\"team\":\"web\"}"],
  ["aca-shop-backend", "rg-prod", "Azure Container Apps", "Standard vCPU Active Usage", 4.9, "{\"env\":\"prod\",\"team\":\"api\"}"],
  // Non-production, never switched off — the point of the sample.
  ["aca-shop-backend-stage", "rg-stage", "Azure Container Apps", "Standard vCPU Idle Usage", 4.4, ""],
  ["vm-test-runner-01", "rg-test", "Virtual Machines", "D4s v5 Compute Hours", 3.9, ""],
  ["aca-checkout-poc", "rg-sandbox", "Azure Container Apps", "Standard vCPU Idle Usage", 2.7, ""],
  ["vm-acc-integration", "rg-acc", "Virtual Machines", "D2s v5 Compute Hours", 2.2, ""],
  // Storage and networking: cost the same whether anyone uses them, so they must not drag
  // the weekend comparison — the detectors deliberately measure compute only.
  ["psql-prod-orders", "rg-prod", "Azure Database for PostgreSQL", "vCore Hours", 3.4, "{\"env\":\"prod\"}"],
  ["st-prod-media", "rg-prod", "Storage", "Hot LRS Data Stored", 1.9, ""],
  ["lb-prod-public", "rg-prod", "Load Balancer", "Standard Rules", 1.1, "{\"env\":\"prod\"}"]
];

// meterName, unit, dailyQuantity, dailyCost — a prompt-heavy assistant: far more tokens in
// than out, most of them served from cache.
var AI_METERS = [
  ["GPT 5 Chat Inpt Glbl 1M Tokens", "1M", 18.0, 0.42],
  ["GPT 5 Chat cd inp Glbl 1M Tokens", "1M", 64.0, 0.31],
  ["GPT 5 Chat outpt Glbl 1M Tokens", "1M", 0.42, 0.55]
];

function pad(n) { return (n < 10 ? "0" : "") + n; }
function cell(v) {
  var s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? "\"" + s.replace(/"/g, "\"\"") + "\"" : s;
}
function idOf(group, name, provider) {
  return "/subscriptions/00000000-1111-2222-3333-444444444444/resourcegroups/" + group +
         "/providers/" + provider + "/" + name;
}

export function buildSampleCSV() {
  var lines = [HEADER.join(",")];
  var sub = "Contoso Productie";
  // Three whole months, so the report has a trend, a mover and ~13 weekends to compare.
  var months = [[2026, 5, 31], [2026, 6, 30], [2026, 7, 31]];

  months.forEach(function (mo, monthIndex) {
    var year = mo[0], month = mo[1], days = mo[2];
    // A steady rise across the three months, so the month-over-month signal has something
    // real to report rather than noise.
    var monthFactor = [1, 1.06, 1.21][monthIndex];

    for (var day = 1; day <= days; day++) {
      var date = year + "-" + pad(month) + "-" + pad(day);
      // Deliberately keyed on day-of-month parity, never on the weekday: the whole point of
      // the sample is an estate whose cost does not know it is Sunday.
      var wobble = 1 + ((day % 5) - 2) * 0.015;

      RESOURCES.forEach(function (r) {
        var name = r[0], group = r[1], category = r[2], meter = r[3], base = r[4], tags = r[5];
        var provider = category === "Virtual Machines" ? "microsoft.compute/virtualmachines"
          : category === "Azure Container Apps" ? "microsoft.app/containerapps"
          : category === "Storage" ? "microsoft.storage/storageaccounts"
          : category === "Load Balancer" ? "microsoft.network/loadbalancers"
          : "microsoft.dbforpostgresql/flexibleservers";
        var cost = base * monthFactor * wobble;
        lines.push([
          date, sub, group, idOf(group, name, provider), category, meter, category,
          "Usage", "OnDemand", "Microsoft", (24).toFixed(0), "1 Hour",
          cost.toFixed(4), "EUR", tags
        ].map(cell).join(","));
      });

      AI_METERS.forEach(function (a) {
        lines.push([
          date, sub, "rg-ai", idOf("rg-ai", "aoai-assistant", "microsoft.cognitiveservices/accounts"),
          "Foundry Models", a[0], "Foundry Models", "Usage", "OnDemand", "Microsoft",
          (a[2] * monthFactor).toFixed(4), a[1], (a[3] * monthFactor).toFixed(4), "EUR", ""
        ].map(cell).join(","));
      });
    }

    // Capacity bought and not consumed — the one finding that is pure, uncontested waste.
    lines.push([
      year + "-" + pad(month) + "-01", sub, "rg-shared",
      idOf("rg-shared", "ri-westeurope-d4s", "microsoft.capacity/reservationorders"),
      "Virtual Machines", "D4s v5 Reserved Capacity", "Virtual Machines",
      "UnusedReservation", "Reservation", "Microsoft", "0", "1 Hour",
      (41.5 * monthFactor).toFixed(4), "EUR", ""
    ].map(cell).join(","));
  });

  return lines.join("\n") + "\n";
}
