(function () {
  "use strict";

  const HOME_ONLY_TARGETS = [
    { selector: "ytd-rich-grid-renderer", label: "home feed grid" },
    { selector: "ytd-rich-shelf-renderer", label: "rich shelf" },
    { selector: "yt-chip-cloud-renderer", label: "chips bar" },
    { selector: "ytd-primetime-promo-renderer", label: "primetime promo" },
    { selector: "ytd-statement-banner-renderer", label: "statement banner" },
  ];

  const GLOBAL_TARGETS = [
    {
      selector: "ytd-watch-next-secondary-results-renderer",
      label: "up next / sidebar recs",
    },
    { selector: ".ytp-endscreen-content", label: "endscreen recommendations" },
    { selector: "ytd-rich-shelf-renderer[is-shorts]", label: "shorts shelf" },
    { selector: "ytd-reel-shelf-renderer", label: "shorts reel shelf" },
    {
      selector: ".ytp-autonav-endscreen-countdown-container",
      label: "autoplay countdown",
    },
  ];

  let bannerInjected = false;

  function isHomePage() {
    return (
      location.pathname === "/" ||
      location.pathname === "/feed" ||
      location.pathname === "/feed/"
    );
  }

  function createBanner() {
    const banner = document.createElement("div");
    banner.id = "unrecommended-banner";
    banner.setAttribute("role", "status");
    banner.style.cssText = [
      "box-sizing:border-box",
      "width:100%",
      "max-width:600px",
      "margin:60px auto",
      "padding:32px 28px",
      "background:#fff",
      "border:1px solid #e0e0e0",
      "border-radius:12px",
      "font-family:'Roboto','Segoe UI',sans-serif",
      "text-align:center",
      "color:#0f0f0f",
    ].join(";");

    banner.innerHTML = `
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#cc0000;">
        Recommendations blocked
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.5;">
        Algorithmic recommendations have been removed by <strong>Unrecommended</strong>.<br>
        Search for what you want to watch instead.
      </p>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
        <a href="https://www.youtube.com/feed/subscriptions"
           style="padding:10px 20px;background:#cc0000;color:#fff;border-radius:24px;
                  text-decoration:none;font-size:14px;font-weight:500;">
          Subscriptions
        </a>
        <a href="https://www.youtube.com/feed/library"
           style="padding:10px 20px;background:#f2f2f2;color:#0f0f0f;border-radius:24px;
                  text-decoration:none;font-size:14px;font-weight:500;">
          Library
        </a>
      </div>
    `;
    return banner;
  }

  function removeAlgorithmicContent() {
    const targets = isHomePage()
      ? [...HOME_ONLY_TARGETS, ...GLOBAL_TARGETS]
      : GLOBAL_TARGETS;

    for (const { selector } of targets) {
      document.querySelectorAll(selector).forEach((el) => {
        el.remove();
      });
    }
  }

  function injectBannerIfNeeded() {
    if (bannerInjected) return;
    if (!isHomePage()) return;

    const container =
      document.querySelector("ytd-browse[page-subtype='home'] #contents") ||
      document.querySelector("ytd-browse #contents") ||
      document.querySelector("#primary") ||
      document.querySelector("ytd-app #content");

    if (!container) return;
    if (document.getElementById("unrecommended-banner")) return;

    container.prepend(createBanner());
    bannerInjected = true;
  }

  let rafScheduled = false;

  function scheduleCleanup() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      removeAlgorithmicContent();
      injectBannerIfNeeded();
    });
  }

  const observer = new MutationObserver(scheduleCleanup);

  function startObserver() {
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function onNavigate() {
    bannerInjected = false;
    scheduleCleanup();
  }

  window.addEventListener("yt-navigate-finish", onNavigate);

  const _pushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    _pushState(...args);
    onNavigate();
  };

  const _replaceState = history.replaceState.bind(history);
  history.replaceState = function (...args) {
    _replaceState(...args);
    onNavigate();
  };

  window.addEventListener("popstate", onNavigate);

  if (document.body) {
    removeAlgorithmicContent();
    injectBannerIfNeeded();
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      removeAlgorithmicContent();
      injectBannerIfNeeded();
      startObserver();
    });
  }
})();
