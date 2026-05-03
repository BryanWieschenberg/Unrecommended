(function () {
  "use strict";

  if (window.__browserToolsAudioAmpInited) return;
  window.__browserToolsAudioAmpInited = true;

  const STORAGE_KEY = "audio_amp_gain";
  const MIN_GAIN = 1;
  const MAX_GAIN = 5;

  let targetGain = 1;
  let ctx = null;
  let limiter = null;
  const attached = new Set();
  let observer = null;

  function clamp(v) {
    const n = Number(v);
    if (!isFinite(n)) return 1;
    return Math.max(MIN_GAIN, Math.min(MAX_GAIN, n));
  }

  function collectMedia(root, out) {
    if (!root) return;
    let list;
    try {
      list = root.querySelectorAll("video, audio");
    } catch (_) {
      return;
    }
    for (const el of list) out.push(el);
    let all;
    try {
      all = root.querySelectorAll("*");
    } catch (_) {
      return;
    }
    for (const el of all) {
      if (el.shadowRoot) collectMedia(el.shadowRoot, out);
    }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(ctx.destination);
    } catch (_) {
      ctx = null;
      limiter = null;
    }
    return ctx;
  }

  function attach(el) {
    if (attached.has(el)) return;
    if (!ensureCtx()) return;
    try {
      const source = ctx.createMediaElementSource(el);
      const gainNode = ctx.createGain();
      gainNode.gain.value = targetGain;
      source.connect(gainNode);
      gainNode.connect(limiter);
      el.__ampGain = gainNode;
      attached.add(el);
    } catch (_) {
      // already bound to another AudioContext, or unsupported
    }
  }

  function attachAll() {
    const list = [];
    collectMedia(document, list);
    for (const el of list) attach(el);
  }

  function applyGainToAll() {
    for (const el of attached) {
      const g = el.__ampGain;
      if (!g) continue;
      try {
        g.gain.value = targetGain;
      } catch (_) {}
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!ctx) return;
      attachAll();
    });
    const root = document.documentElement || document;
    observer.observe(root, { subtree: true, childList: true });
  }

  function setGain(v) {
    targetGain = clamp(v);
    if (targetGain === 1 && !ctx) return;
    if (!ensureCtx()) return;
    attachAll();
    applyGainToAll();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "audio_amp_changed") {
      setGain(msg.value);
    }
  });

  function init() {
    startObserver();
    chrome.storage.sync.get({ [STORAGE_KEY]: 1 }, (data) => {
      const v = clamp(data[STORAGE_KEY]);
      targetGain = v;
      if (v !== 1) {
        if (ensureCtx()) {
          attachAll();
          applyGainToAll();
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
