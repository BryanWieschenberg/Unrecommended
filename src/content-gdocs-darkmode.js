(function () {
  "use strict";

  const TOOL_KEY = "darkmode_gdocs";
  const STYLE_ID = "browser-tools-gdocs-darkmode";

  const DARK_CSS = `
    html {
      background-color: #1e1e1e !important;
    }

    html > body {
      filter: invert(1) hue-rotate(180deg) !important;
      background-color: #fff !important;
    }

    img,
    svg,
    video,
    [style*="background-image"],
    .docs-icon-img,
    .docs-icon-img-container,
    .kix-embeddedobject-image {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    .kix-page,
    .kix-page-paginated,
    .kix-page-content-wrapper {
      box-shadow: 0 1px 6px rgba(255,255,255,0.08) !important;
    }

    ::-webkit-scrollbar {
      background: #2b2b2b;
    }
    ::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 4px;
    }
  `;

  if (
    location.pathname.startsWith("/spreadsheets") ||
    location.pathname.startsWith("/presentation")
  )
    return;

  let enabled = false;

  const earlyStyle = document.createElement("style");
  earlyStyle.id = STYLE_ID;
  earlyStyle.textContent =
    DARK_CSS +
    `
    html { visibility: hidden !important; }
  `;
  (document.head || document.documentElement).appendChild(earlyStyle);

  function injectDarkMode() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = DARK_CSS;
  }

  function removeDarkMode() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function apply() {
    if (enabled) {
      injectDarkMode();
    } else {
      removeDarkMode();
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "tool_toggled" && msg.tool === TOOL_KEY) {
      enabled = msg.enabled;
      apply();
    }
  });

  function init() {
    chrome.storage.sync.get({ [TOOL_KEY]: false }, (settings) => {
      enabled = settings[TOOL_KEY];
      apply();
    });
  }

  init();
})();
