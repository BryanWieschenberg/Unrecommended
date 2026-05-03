(function () {
  "use strict";

  if (!location.pathname.toLowerCase().endsWith(".pdf")) return;

  const TOOL_KEY = "darkmode_pdf";
  const STYLE_ID = "browser-tools-pdf-darkmode";
  const SVG_ID = "browser-tools-pdf-svg";
  const HIDE_ID = "browser-tools-pdf-darkmode-hide";
  const FILTER_ID = "browser-tools-pdf-darkmode-filter";
  const TOOLBAR_HEIGHT = 56;
  const DEFAULT_PDF_ASPECT = 0.71;
  const SIDE_OFFSET = 8;
  const SIDE_BG = "#1e1e1e";

  let pdfAspect = DEFAULT_PDF_ASPECT;

  const DARK_CSS = `
    html {
      filter: url(#${FILTER_ID}) !important;
      background-color: #1e1e1e !important;
    }
  `;

  let zoomFactor = 1;

  function getSideMargin() {
    const vw = window.innerWidth;
    const vh = Math.max(0, window.innerHeight - TOOLBAR_HEIGHT);
    const pdfW = vh * pdfAspect * zoomFactor;
    return Math.max(0, Math.floor((vw - pdfW) / 2));
  }

  function buildSvgMarkup() {
    const vw = window.innerWidth;
    const sideMargin = getSideMargin();
    const leftWidth = Math.max(0, sideMargin - SIDE_OFFSET);
    const rightWidth = sideMargin + SIDE_OFFSET;
    const rightX = Math.max(0, vw - rightWidth);
    return `
<svg xmlns="http://www.w3.org/2000/svg" id="${SVG_ID}" style="position:fixed;left:-9999px;top:-9999px;width:0;height:0" aria-hidden="true">
  <defs>
    <filter id="${FILTER_ID}" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" result="inv"/>
      <feColorMatrix in="inv" type="hueRotate" values="180" result="dark"/>
      <feFlood flood-color="white" flood-opacity="1" x="0" y="${TOOLBAR_HEIGHT}" width="100000" height="100000" result="bottomMask"/>
      <feComposite in="dark" in2="bottomMask" operator="in" result="darkBottom"/>
      <feFlood flood-color="${SIDE_BG}" flood-opacity="1" x="0" y="${TOOLBAR_HEIGHT}" width="${leftWidth}" height="100000" result="leftDark"/>
      <feFlood flood-color="${SIDE_BG}" flood-opacity="1" x="${rightX}" y="${TOOLBAR_HEIGHT}" width="${rightWidth}" height="100000" result="rightDark"/>
      <feFlood flood-color="white" flood-opacity="1" x="0" y="0" width="100000" height="${TOOLBAR_HEIGHT}" result="topMask"/>
      <feComposite in="SourceGraphic" in2="topMask" operator="in" result="origTop"/>
      <feMerge>
        <feMergeNode in="darkBottom"/>
        <feMergeNode in="leftDark"/>
        <feMergeNode in="rightDark"/>
        <feMergeNode in="origTop"/>
      </feMerge>
    </filter>
  </defs>
</svg>
`;
  }

  const earlyStyle = document.createElement("style");
  earlyStyle.id = HIDE_ID;
  earlyStyle.textContent = `html { visibility: hidden !important; background-color: #1e1e1e !important; }`;
  (document.head || document.documentElement).appendChild(earlyStyle);

  let enabled = false;
  let resizeHandler = null;
  let pendingUpdate = false;

  function scheduleSvgUpdate() {
    if (pendingUpdate) return;
    pendingUpdate = true;
    requestAnimationFrame(() => {
      pendingUpdate = false;
      if (enabled) injectSvg();
    });
  }

  function injectSvg() {
    const existing = document.getElementById(SVG_ID);
    if (existing) existing.remove();
    const tmpl = document.createElement("template");
    tmpl.innerHTML = buildSvgMarkup().trim();
    const svg = tmpl.content.firstElementChild;
    (document.body || document.documentElement).appendChild(svg);
  }

  function injectDark() {
    injectSvg();
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = DARK_CSS;
    if (!resizeHandler) {
      resizeHandler = () => {
        if (enabled) injectSvg();
      };
      window.addEventListener("resize", resizeHandler);
    }
  }

  function removeDark() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    const svg = document.getElementById(SVG_ID);
    if (svg) svg.remove();
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
  }

  function reveal() {
    const hide = document.getElementById(HIDE_ID);
    if (hide) hide.remove();
  }

  function apply() {
    if (enabled) injectDark();
    else removeDark();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "tool_toggled" && msg.tool === TOOL_KEY) {
      enabled = msg.enabled;
      apply();
    }
    if (msg.type === "zoom_changed") {
      zoomFactor = msg.zoomFactor;
      scheduleSvgUpdate();
    }
    if (msg.type === "pdf_aspect_changed") {
      pdfAspect = Number(msg.value) || DEFAULT_PDF_ASPECT;
      scheduleSvgUpdate();
    }
  });

  function init() {
    chrome.storage.sync.get(
      { [TOOL_KEY]: false, darkmode_pdf_aspect: DEFAULT_PDF_ASPECT },
      (settings) => {
        enabled = settings[TOOL_KEY];
        pdfAspect = Number(settings.darkmode_pdf_aspect) || DEFAULT_PDF_ASPECT;
        apply();
        reveal();
      }
    );
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
