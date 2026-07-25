// boot.js — keeps the initial payload light (approach #2).
// The scanner module is only fetched once the #scan section approaches the
// viewport, so the marketing/export content renders without any app code.
(function () {
  "use strict";
  var mount = document.querySelector("[data-scan-app]");
  if (!mount) return;

  // Resolve scan.js relative to THIS script's own URL, so it works whether the
  // site is served from a domain root or a project subpath (e.g. /flsnl/).
  // A dynamic import() in a classic script otherwise resolves against the
  // document URL, which differs between / and /azure/.
  var self = document.currentScript || document.querySelector('script[src$="/boot.js"]');
  var scanUrl = new URL("scan.js", self.src).href;

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    import(scanUrl)
      .then(function (mod) { mod.init(mount); })
      .catch(function (err) {
        var status = mount.querySelector("[data-status]");
        if (status) {
          status.textContent = "De scanner kon niet laden. Ververs de pagina en probeer opnieuw.";
          status.classList.add("error");
        }
        // Surface the real cause in the console for debugging.
        if (window.console) console.error("scan.js failed to load", err);
      });
  }

  // Load as soon as the app section gets close, or immediately if the user
  // deep-linked straight to #scan.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); load(); break; }
      }
    }, { rootMargin: "400px" });
    io.observe(mount);
  } else {
    load();
  }
  if (location.hash === "#scan") load();
})();
