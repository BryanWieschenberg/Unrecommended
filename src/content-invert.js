(function () {
  "use strict";

  const TOOL_KEY = "invert_colors";
  const STYLE_ID = "browser-tools-invert-colors";

  const SKIP_DOMAINS = [
    "youtube.com",
    "google.com",
    "instructure.com",
  ];

  const host = location.hostname;
  if (SKIP_DOMAINS.some((d) => host === d || host.endsWith("." + d))) return;
  if (location.pathname.toLowerCase().endsWith(".pdf")) return;

  const INVERT_CSS = `
    html {
      filter: invert(1) hue-rotate(180deg) !important;
      background-color: #fff !important;
    }

    img,
    svg,
    video,
    canvas,
    picture,
    [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    ::-webkit-scrollbar {
      background: #2b2b2b;
    }
    ::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 4px;
    }
  `;

  let enabled = false;
  let whitelisted = false;

  function isWhitelisted(domains) {
    return domains.some((d) => host === d || host.endsWith("." + d));
  }

  const earlyStyle = document.createElement("style");
  earlyStyle.id = STYLE_ID;
  earlyStyle.textContent =
    INVERT_CSS +
    `
    html { visibility: hidden !important; }
  `;
  (document.head || document.documentElement).appendChild(earlyStyle);

  function injectInvert() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = INVERT_CSS;
  }

  function removeInvert() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function apply() {
    if (enabled && !whitelisted) {
      injectInvert();
    } else {
      removeInvert();
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "tool_toggled" && msg.tool === TOOL_KEY) {
      enabled = msg.enabled;
      apply();
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.invert_whitelist) {
      whitelisted = isWhitelisted(changes.invert_whitelist.newValue || []);
      apply();
    }
  });

  function init() {
    chrome.storage.sync.get({ [TOOL_KEY]: false, invert_whitelist: [] }, (settings) => {
      enabled = settings[TOOL_KEY];
      whitelisted = isWhitelisted(settings.invert_whitelist);
      apply();
    });
  }

  init();
})();
