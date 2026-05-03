const DEFAULT_PDF_ASPECT = 0.71;
const DEFAULT_TAB = "darkmode";

// --- Tabs ---
const tabButtons = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");

function setActiveTab(name) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
  chrome.storage.sync.set({ popup_active_tab: name });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

chrome.storage.sync.get(
  { popup_active_tab: DEFAULT_TAB, lockdown_mode: false, lockdown_until: 0 },
  (data) => {
    const lockdownActive =
      data.lockdown_mode && data.lockdown_until > Date.now();
    setActiveTab(lockdownActive ? "lockdown" : data.popup_active_tab || DEFAULT_TAB);
  }
);

const DEFAULTS = {
  darkmode_gdocs: false,
  darkmode_gsheets: false,
  darkmode_gslides: false,
  darkmode_canvas: false,
  darkmode_youtube: false,
  darkmode_pdf: false,
  darkmode_pdf_aspect: DEFAULT_PDF_ASPECT,
  invert_colors: false,
};

const BREAKOUT_PHRASES = [
  "I am fully aware that I am choosing short term distraction over the long term goals that I claimed were important to me and I accept that this is a failure of discipline on my part",
  "I would rather waste the next several hours doing absolutely nothing productive than follow through on the commitment I made to myself when I started this lockdown session",
  "I am deliberately breaking the promise I made to myself because I lack the self control to stay focused and I understand that nobody forced me to do this except my own weakness",
  "I recognize that future me will look back on this moment with disappointment and regret but I am choosing to give in to temptation anyway because I do not have the willpower to resist",
  "I am typing this entire sentence out letter by letter because I could not handle being away from distracting websites for the amount of time that I originally chose for myself",
  "I solemnly acknowledge that I set this timer of my own free will and I am now going back on my word because a few minutes of mindless scrolling feels more important than my actual responsibilities",
];

// --- Dark mode toggles ---
const toggles = document.querySelectorAll("[data-tool]");

chrome.storage.sync.get(DEFAULTS, (settings) => {
  toggles.forEach((input) => {
    const key = input.dataset.tool;
    input.checked = settings[key];
  });
});

toggles.forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.dataset.tool;
    const value = input.checked;
    chrome.storage.sync.set({ [key]: value });
    chrome.runtime.sendMessage({
      type: "tool_toggled",
      tool: key,
      enabled: value,
    });
  });
});

// --- PDF darkmode side width ---
const pdfAspectSlider = document.getElementById("pdf-aspect");
const pdfAspectValue = document.getElementById("pdf-aspect-value");

function renderPdfAspect(value) {
  pdfAspectSlider.value = String(value);
  pdfAspectValue.textContent = Number(value).toFixed(2);
}

chrome.storage.sync.get({ darkmode_pdf_aspect: DEFAULT_PDF_ASPECT }, (data) => {
  renderPdfAspect(data.darkmode_pdf_aspect);
});

pdfAspectSlider.addEventListener("input", () => {
  const value = Number(pdfAspectSlider.value);
  pdfAspectValue.textContent = value.toFixed(2);
  chrome.runtime.sendMessage({ type: "pdf_aspect_changed", value });
});

pdfAspectSlider.addEventListener("change", () => {
  const value = Number(pdfAspectSlider.value);
  chrome.storage.sync.set({ darkmode_pdf_aspect: value });
});

// --- Audio amplification ---
const audioAmpSlider = document.getElementById("audio-amp");
const audioAmpValue = document.getElementById("audio-amp-value");

function renderAudioAmp(value) {
  const v = Number(value) || 1;
  audioAmpSlider.value = String(v);
  audioAmpValue.textContent = v.toFixed(1) + "x";
}

chrome.storage.sync.get({ audio_amp_gain: 1 }, (data) => {
  renderAudioAmp(data.audio_amp_gain);
});

audioAmpSlider.addEventListener("input", () => {
  const value = Number(audioAmpSlider.value);
  audioAmpValue.textContent = value.toFixed(1) + "x";
  chrome.runtime.sendMessage({ type: "audio_amp_changed", value });
});

audioAmpSlider.addEventListener("change", () => {
  const value = Number(audioAmpSlider.value);
  chrome.storage.sync.set({ audio_amp_gain: value });
});

// --- Lockdown mode ---
const lockdownInactive = document.getElementById("lockdown-inactive");
const lockdownActive = document.getElementById("lockdown-active");
const lockdownTimer = document.getElementById("lockdown-timer");
const endEarlyBtn = document.getElementById("end-early-btn");
const breakoutOverlay = document.getElementById("breakout-overlay");
const breakoutPhrase = document.getElementById("breakout-phrase");
const breakoutInput = document.getElementById("breakout-input");
const durationBtns = document.querySelectorAll("[data-minutes]");

let timerInterval = null;

function formatTime(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return h + ":" + m + ":" + s;
}

function showInactive() {
  lockdownInactive.style.display = "";
  lockdownActive.style.display = "none";
  breakoutOverlay.classList.remove("visible");
  breakoutInput.value = "";
  clearInterval(timerInterval);
}

function showActive() {
  lockdownInactive.style.display = "none";
  lockdownActive.style.display = "";
  breakoutOverlay.classList.remove("visible");
  breakoutInput.value = "";
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  chrome.storage.sync.get({ lockdown_until: 0 }, (data) => {
    const remaining = data.lockdown_until - Date.now();
    if (remaining <= 0) {
      disableLockdown();
      return;
    }
    lockdownTimer.textContent = formatTime(remaining);
  });
}

function enableLockdown(minutes) {
  const until = Date.now() + minutes * 60 * 1000;
  chrome.storage.sync.set({ lockdown_mode: true, lockdown_until: until }, () => {
    showActive();
    chrome.runtime.sendMessage({
      type: "tool_toggled",
      tool: "lockdown_mode",
      enabled: true,
    });
  });
}

function disableLockdown() {
  chrome.storage.sync.set({ lockdown_mode: false, lockdown_until: 0 }, () => {
    showInactive();
    chrome.runtime.sendMessage({
      type: "tool_toggled",
      tool: "lockdown_mode",
      enabled: false,
    });
  });
}

// Duration buttons
durationBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    enableLockdown(parseInt(btn.dataset.minutes, 10));
  });
});

// End early -> show breakout challenge
endEarlyBtn.addEventListener("click", () => {
  const phrase =
    BREAKOUT_PHRASES[Math.floor(Math.random() * BREAKOUT_PHRASES.length)];
  breakoutPhrase.textContent = phrase;
  breakoutInput.value = "";
  breakoutOverlay.classList.add("visible");
  lockdownActive.style.display = "none";
  breakoutInput.focus();
});

// Check breakout input
breakoutInput.addEventListener("input", () => {
  if (breakoutInput.value === breakoutPhrase.textContent) {
    disableLockdown();
  }
});

// Init: check if lockdown is active
chrome.storage.sync.get({ lockdown_mode: false, lockdown_until: 0 }, (data) => {
  if (data.lockdown_mode && data.lockdown_until > Date.now()) {
    showActive();
  } else if (data.lockdown_mode) {
    disableLockdown();
  } else {
    showInactive();
  }
});

// --- YouTube Whitelist ---
const whitelistUrlInput = document.getElementById("whitelist-url");
const whitelistAddBtn = document.getElementById("whitelist-add-btn");
const whitelistList = document.getElementById("whitelist-list");
const whitelistEmpty = document.getElementById("whitelist-empty");

function parseYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host !== "youtube.com" && host !== "youtu.be") return null;

    const listId = u.searchParams.get("list");
    const videoId = u.searchParams.get("v") || (host === "youtu.be" ? u.pathname.slice(1) : null);

    if (listId) return { type: "playlist", id: listId, label: "Playlist: " + listId };
    if (videoId) return { type: "video", id: videoId, label: "Video: " + videoId };
    return null;
  } catch (_) {
    return null;
  }
}

function renderWhitelist(entries) {
  whitelistList.querySelectorAll(".whitelist-item").forEach((el) => el.remove());
  whitelistEmpty.style.display = entries.length ? "none" : "";

  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "whitelist-item";

    const link = document.createElement("a");
    link.className = "wl-label";
    link.textContent = entry.label;
    link.title = entry.type + ": " + entry.id;
    link.target = "_blank";
    if (entry.type === "playlist") {
      link.href = "https://www.youtube.com/playlist?list=" + entry.id;
    } else {
      link.href = "https://www.youtube.com/watch?v=" + entry.id;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "wl-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", () => removeWhitelistEntry(entry));

    item.appendChild(link);
    item.appendChild(removeBtn);
    whitelistList.appendChild(item);
  }
}

function loadWhitelist() {
  chrome.storage.sync.get({ yt_whitelist: [] }, (data) => {
    renderWhitelist(data.yt_whitelist);
  });
}

function removeWhitelistEntry(entry) {
  chrome.storage.sync.get({ yt_whitelist: [] }, (data) => {
    const updated = data.yt_whitelist.filter(
      (e) => !(e.type === entry.type && e.id === entry.id)
    );
    chrome.storage.sync.set({ yt_whitelist: updated }, () => {
      renderWhitelist(updated);
    });
  });
}

whitelistAddBtn.addEventListener("click", () => {
  const parsed = parseYouTubeUrl(whitelistUrlInput.value.trim());
  if (!parsed) {
    whitelistUrlInput.style.borderColor = "#d32f2f";
    setTimeout(() => (whitelistUrlInput.style.borderColor = ""), 1500);
    return;
  }

  chrome.storage.sync.get({ yt_whitelist: [] }, (data) => {
    const exists = data.yt_whitelist.some(
      (e) => e.type === parsed.type && e.id === parsed.id
    );
    if (exists) {
      whitelistUrlInput.value = "";
      return;
    }
    const updated = [...data.yt_whitelist, parsed];
    chrome.storage.sync.set({ yt_whitelist: updated }, () => {
      whitelistUrlInput.value = "";
      renderWhitelist(updated);
    });
  });
});

whitelistUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") whitelistAddBtn.click();
});

loadWhitelist();

// --- Invert Colors Whitelist ---
const invertWlInput = document.getElementById("invert-wl-input");
const invertWlAddBtn = document.getElementById("invert-wl-add-btn");
const invertWlList = document.getElementById("invert-wl-list");
const invertWlEmpty = document.getElementById("invert-wl-empty");

function renderInvertWhitelist(domains) {
  invertWlList.querySelectorAll(".whitelist-item").forEach((el) => el.remove());
  invertWlEmpty.style.display = domains.length ? "none" : "";

  for (const domain of domains) {
    const item = document.createElement("div");
    item.className = "whitelist-item";

    const label = document.createElement("span");
    label.className = "wl-label";
    label.textContent = domain;
    label.style.color = "#555";

    const removeBtn = document.createElement("button");
    removeBtn.className = "wl-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", () => removeInvertWlEntry(domain));

    item.appendChild(label);
    item.appendChild(removeBtn);
    invertWlList.appendChild(item);
  }
}

function loadInvertWhitelist() {
  chrome.storage.sync.get({ invert_whitelist: [] }, (data) => {
    renderInvertWhitelist(data.invert_whitelist);
  });
}

function removeInvertWlEntry(domain) {
  chrome.storage.sync.get({ invert_whitelist: [] }, (data) => {
    const updated = data.invert_whitelist.filter((d) => d !== domain);
    chrome.storage.sync.set({ invert_whitelist: updated }, () => {
      renderInvertWhitelist(updated);
    });
  });
}

invertWlAddBtn.addEventListener("click", () => {
  const raw = invertWlInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!raw || !raw.includes(".")) {
    invertWlInput.style.borderColor = "#d32f2f";
    setTimeout(() => (invertWlInput.style.borderColor = ""), 1500);
    return;
  }

  chrome.storage.sync.get({ invert_whitelist: [] }, (data) => {
    if (data.invert_whitelist.includes(raw)) {
      invertWlInput.value = "";
      return;
    }
    const updated = [...data.invert_whitelist, raw];
    chrome.storage.sync.set({ invert_whitelist: updated }, () => {
      invertWlInput.value = "";
      renderInvertWhitelist(updated);
    });
  });
});

invertWlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") invertWlAddBtn.click();
});

loadInvertWhitelist();
