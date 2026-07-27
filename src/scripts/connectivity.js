// Online/offline indicator for the Azure Waste Scan page.
//
// The scan's core promise is that nothing is transmitted, and the honest way to prove it is to
// let the reader switch on airplane mode and watch the analysis keep working. This reports one
// fact — whether the browser currently has a connection — next to the contact button.
//
// navigator.onLine is the only signal used, deliberately: the page's CSP sets
// connect-src 'none', so we cannot probe a server to confirm reachability, and doing so would
// contradict the promise anyway. Its known weakness — "connected to a network" is not "the
// internet is reachable" — does not apply to airplane mode, which is the case this is for.
"use strict";

/**
 * Wire up the indicator element. Safe to call with null (pages without one).
 */
export function initConnectivity(el) {
  if (!el) return;

  const text = el.querySelector("[data-connectivity-text]");

  const render = () => {
    const state = navigator.onLine ? "online" : "offline";
    // Also the flag that reveals the indicator: it stays display:none until a state exists,
    // so a visitor without JS never sees a status that nothing is keeping up to date.
    el.dataset.state = state;
    if (text) {
      text.textContent = (state === "online" ? el.dataset.labelOnline : el.dataset.labelOffline) ?? "";
    }
  };

  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  render();
}
