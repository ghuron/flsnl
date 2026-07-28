// Synthetic Azure usage export, shaped like a real Cost Management CSV, used only by the
// "sample report" button (scan.js) so a first-time visitor can see a populated report with
// zero effort. Deliberately run through the real parseCSV/detectColumns pipeline rather than
// shipped as pre-parsed objects: a parsing regression breaks the demo too, and the fixture can
// never drift out of sync with what buildModel() actually expects from a dataset.
//
// Engineered to trip several real signals across three months (mei/jun/jul 2026): an unused
// reservation charge, ~97% on-demand coverage, a large month-over-month jump driven by Virtual
// Machines (also a watchlist category), a brand new "Azure OpenAI" line that didn't exist the
// month before, ~82% spend concentration in the top five resources, and ~32% of spend with no
// tags. None of this is real Azure billing data.
export const SAMPLE_CSV =
  "Date,ResourceGroupName,ResourceName,SubscriptionName,MeterCategory,ChargeType,PricingModel,CostInBillingCurrency,BillingCurrency,Tags\n" +
  "2026-05-15,rg-prod,vm-prod-web-01,Contoso Productie,Virtual Machines,Usage,OnDemand,2200,EUR,env=prod|team=web\n" +
  "2026-05-15,rg-prod,vm-prod-web-02,Contoso Productie,Virtual Machines,Usage,OnDemand,2200,EUR,env=prod|team=web\n" +
  "2026-05-15,rg-prod,vm-prod-api-01,Contoso Productie,Virtual Machines,Usage,OnDemand,1600,EUR,env=prod|team=api\n" +
  "2026-05-15,rg-prod,storage-prod-data,Contoso Productie,Storage,Usage,OnDemand,1500,EUR,\n" +
  "2026-05-15,rg-prod,vnet-prod-hub,Contoso Productie,Networking,Usage,OnDemand,800,EUR,\n" +
  "2026-05-15,rg-prod,lb-prod-public,Contoso Productie,Load Balancer,Usage,OnDemand,700,EUR,env=prod\n" +
  "2026-06-15,rg-prod,vm-prod-web-01,Contoso Productie,Virtual Machines,Usage,OnDemand,2300,EUR,env=prod|team=web\n" +
  "2026-06-15,rg-prod,vm-prod-web-02,Contoso Productie,Virtual Machines,Usage,OnDemand,2300,EUR,env=prod|team=web\n" +
  "2026-06-15,rg-prod,vm-prod-api-01,Contoso Productie,Virtual Machines,Usage,OnDemand,1600,EUR,env=prod|team=api\n" +
  "2026-06-15,rg-prod,storage-prod-data,Contoso Productie,Storage,Usage,OnDemand,1550,EUR,\n" +
  "2026-06-15,rg-prod,vnet-prod-hub,Contoso Productie,Networking,Usage,OnDemand,820,EUR,\n" +
  "2026-06-15,rg-prod,lb-prod-public,Contoso Productie,Load Balancer,Usage,OnDemand,720,EUR,env=prod\n" +
  "2026-07-15,rg-prod,vm-prod-web-01,Contoso Productie,Virtual Machines,Usage,OnDemand,3200,EUR,env=prod|team=web\n" +
  "2026-07-15,rg-prod,vm-prod-web-02,Contoso Productie,Virtual Machines,Usage,OnDemand,3200,EUR,env=prod|team=web\n" +
  "2026-07-15,rg-prod,vm-prod-api-01,Contoso Productie,Virtual Machines,Usage,OnDemand,2100,EUR,env=prod|team=api\n" +
  "2026-07-15,rg-test,vm-test-nightly-01,Contoso Sandbox,Virtual Machines,Usage,OnDemand,1000,EUR,\n" +
  "2026-07-15,rg-shared,reservation-pool-eastus,Contoso Sandbox,Virtual Machines,UnusedReservation,Reservation,900,EUR,\n" +
  "2026-07-15,rg-prod,storage-prod-data,Contoso Productie,Storage,Usage,OnDemand,1600,EUR,\n" +
  "2026-07-15,rg-prod,vnet-prod-hub,Contoso Productie,Networking,Usage,OnDemand,830,EUR,\n" +
  "2026-07-15,rg-prod,lb-prod-public,Contoso Productie,Load Balancer,Usage,OnDemand,800,EUR,env=prod\n" +
  "2026-07-15,rg-ai,aoai-prod-gpt4,Contoso Sandbox,Azure OpenAI,Usage,OnDemand,1800,EUR,\n";
