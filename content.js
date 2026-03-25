(function () {
  "use strict";

  const REMOVE_TARGETS = [
    {
      selector: "main [data-finite-scroll-hotkey-context]",
      label: "feed scroll container",
    },
    {
      selector: "div[data-id^='urn:li:activity']",
      label: "feed activity post",
    },
    {
      selector: "div[data-id^='urn:li:aggregate']",
      label: "feed aggregate post",
    },
    {
      selector: "div[data-id^='urn:li:sponsoredNativeAd']",
      label: "sponsored post",
    },
    {
      selector: "aside [aria-label*='recommendation' i]",
      label: "recommendations aside",
    },
    {
      selector: "aside section[aria-label*='people you may know' i]",
      label: "people you may know",
    },
    {
      selector: "aside section[aria-label*='suggested' i]",
      label: "suggested section aside",
    },
    { selector: "aside [aria-label*='news' i]", label: "news widget" },
    {
      selector: "[data-view-name='feed-follow-recommendation']",
      label: "follow recommendation",
    },
    {
      selector: "[data-view-name='feed-discover-module']",
      label: "discover module",
    },
  ];

  let bannerInjected = false;

  function createBanner() {
    const banner = document.createElement("div");
    banner.id = "unrecommended-banner";
    banner.setAttribute("role", "status");
    banner.style.cssText = [
      "box-sizing:border-box",
      "width:100%",
      "max-width:560px",
      "margin:40px auto",
      "padding:32px 28px",
      "background:#fff",
      "border:1px solid #e0e0e0",
      "border-radius:8px",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      "text-align:center",
      "color:#333",
    ].join(";");

    banner.innerHTML = `
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0a66c2;">
        Feed blocked
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.5;">
        The algorithmic feed has been removed by <strong>Unrecommended</strong>.<br>
        Use LinkedIn with intention.
      </p>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
        <a href="https://www.linkedin.com/mynetwork/"
           style="padding:10px 20px;background:#0a66c2;color:#fff;border-radius:24px;
                  text-decoration:none;font-size:14px;font-weight:500;">
          My Network
        </a>
        <a href="https://www.linkedin.com/messaging/"
           style="padding:10px 20px;background:#f3f2ef;color:#333;border-radius:24px;
                  text-decoration:none;font-size:14px;font-weight:500;">
          Messaging
        </a>
      </div>
    `;
    return banner;
  }

  function removeAlgorithmicContent() {
    for (const { selector } of REMOVE_TARGETS) {
      document.querySelectorAll(selector).forEach((el) => {
        el.remove();
      });
    }
  }

  function injectBannerIfNeeded() {
    if (bannerInjected) return;

    const isFeedPage =
      location.pathname === "/" || location.pathname.startsWith("/feed");

    if (!isFeedPage) return;

    const main =
      document.querySelector("main") || document.querySelector('[role="main"]');
    if (!main) return;
    if (document.getElementById("unrecommended-banner")) return;

    main.prepend(createBanner());
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
