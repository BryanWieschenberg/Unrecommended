const BLOCKED_URL = chrome.runtime.getURL("src/blocked.html");

function blockedUrl(site) {
  return BLOCKED_URL + "?site=" + encodeURIComponent(site);
}

const FEED_PATTERNS = [
  {
    site: "tiktok",
    pattern: /^https:\/\/(www\.)?tiktok\.com(\/.*)?(\?.*)?$/,
    redirect: blockedUrl("TikTok"),
  },
  {
    site: "linkedin",
    pattern: /^https:\/\/www\.linkedin\.com\/feed\/?$/,
    redirect: "https://www.linkedin.com/mynetwork/",
  },
  {
    site: "youtube-home",
    pattern: /^https:\/\/www\.youtube\.com\/?(\?.*)?$/,
    redirect: "https://www.youtube.com/feed/subscriptions",
  },
  {
    site: "youtube-shorts",
    pattern: /^https:\/\/www\.youtube\.com\/shorts(\/.*)?(\?.*)?$/,
    redirect: "https://www.youtube.com/feed/subscriptions",
  },
  {
    site: "instagram",
    pattern: /^https:\/\/www\.instagram\.com\/reels?\/?(\?.*)?$/,
    redirect: "https://www.instagram.com/",
  },
];

const LOCKDOWN_PATTERNS = [
  { pattern: /^https:\/\/(www\.)?youtube\.com(\/.*)?(\?.*)?$/, name: "YouTube" },
  { pattern: /^https:\/\/(www\.)?instagram\.com(\/.*)?(\?.*)?$/, name: "Instagram" },
  { pattern: /^https:\/\/(www\.)?tiktok\.com(\/.*)?(\?.*)?$/, name: "TikTok" },
  { pattern: /^https:\/\/(www\.)?paramountplus\.com(\/.*)?(\?.*)?$/, name: "Paramount+" },
  { pattern: /^https:\/\/(www\.)?netflix\.com(\/.*)?(\?.*)?$/, name: "Netflix" },
  { pattern: /^https:\/\/(www\.)?primevideo\.com(\/.*)?(\?.*)?$/, name: "Prime Video" },
  { pattern: /^https:\/\/(www\.)?amazon\.com\/gp\/video(\/.*)?(\?.*)?$/, name: "Prime Video" },
  { pattern: /^https:\/\/(www\.)?disneyplus\.com(\/.*)?(\?.*)?$/, name: "Disney+" },
  { pattern: /^https:\/\/(www\.)?max\.com(\/.*)?(\?.*)?$/, name: "Max" },
  { pattern: /^https:\/\/(www\.)?hulu\.com(\/.*)?(\?.*)?$/, name: "Hulu" },
  { pattern: /^https:\/\/(www\.)?peacocktv\.com(\/.*)?(\?.*)?$/, name: "Peacock" },
  { pattern: /^https:\/\/(www\.)?reddit\.com(\/.*)?(\?.*)?$/, name: "Reddit" },
  { pattern: /^https:\/\/(www\.|old\.)?reddit\.com(\/.*)?(\?.*)?$/, name: "Reddit" },
  { pattern: /^https:\/\/(www\.)?x\.com(\/.*)?(\?.*)?$/, name: "X" },
  { pattern: /^https:\/\/(www\.)?twitter\.com(\/.*)?(\?.*)?$/, name: "X" },
  { pattern: /^https:\/\/(www\.)?threads\.net(\/.*)?(\?.*)?$/, name: "Threads" },
  { pattern: /^https:\/\/(www\.)?twitch\.tv(\/.*)?(\?.*)?$/, name: "Twitch" },
];

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    checkAndRedirect(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab.url) {
      checkAndRedirect(tabId, tab.url);
    }
  });
});

function isYouTubeWhitelisted(url, whitelist) {
  if (!whitelist.length) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host !== "youtube.com" && host !== "youtu.be") return false;

    const videoId = u.searchParams.get("v") || (host === "youtu.be" ? u.pathname.slice(1) : null);
    const listId = u.searchParams.get("list");

    for (const entry of whitelist) {
      if (entry.type === "video" && videoId === entry.id) return true;
      if (entry.type === "playlist" && listId === entry.id) return true;
    }
  } catch (_) {}
  return false;
}

function checkAndRedirect(tabId, url) {
  if (url.startsWith(BLOCKED_URL)) return;

  // Redirect highlighted feed posts to direct post URL
  try {
    const u = new URL(url);
    if (
      u.hostname === "www.linkedin.com" &&
      (u.pathname === "/feed/" || u.pathname === "/feed") &&
      u.searchParams.has("highlightedUpdateUrn")
    ) {
      const urn = u.searchParams.get("highlightedUpdateUrn");
      chrome.tabs.update(tabId, {
        url: "https://www.linkedin.com/feed/update/" + urn + "/",
      });
      return;
    }
  } catch (_) {}

  for (const { pattern, redirect } of FEED_PATTERNS) {
    if (pattern.test(url)) {
      chrome.tabs.update(tabId, { url: redirect });
      return;
    }
  }

  chrome.storage.sync.get(
    { lockdown_mode: false, lockdown_until: 0, yt_whitelist: [] },
    (settings) => {
      if (!settings.lockdown_mode || settings.lockdown_until <= Date.now()) return;

      if (isYouTubeWhitelisted(url, settings.yt_whitelist)) return;

      for (const { pattern, name } of LOCKDOWN_PATTERNS) {
        if (pattern.test(url)) {
          chrome.tabs.update(tabId, { url: blockedUrl(name) });
          return;
        }
      }
    }
  );
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "tool_toggled") return;

  if (msg.tool === "lockdown_mode" && msg.enabled) {
    chrome.storage.sync.get({ lockdown_until: 0, yt_whitelist: [] }, (data) => {
      if (data.lockdown_until > Date.now()) {
        chrome.alarms.create("lockdown_expire", {
          when: data.lockdown_until,
        });
      }

      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (!tab.id || !tab.url) continue;
          if (isYouTubeWhitelisted(tab.url, data.yt_whitelist)) continue;
          for (const { pattern, name } of LOCKDOWN_PATTERNS) {
            if (pattern.test(tab.url)) {
              chrome.tabs.update(tab.id, { url: blockedUrl(name) });
              break;
            }
          }
        }
      });
    });
  }

  if (msg.tool === "lockdown_mode" && !msg.enabled) {
    chrome.alarms.clear("lockdown_expire");
  }

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "lockdown_expire") {
    chrome.storage.sync.set({ lockdown_mode: false, lockdown_until: 0 });
  }
});

chrome.tabs.onZoomChange.addListener(({ tabId, newZoomFactor }) => {
  chrome.tabs.sendMessage(tabId, {
    type: "zoom_changed",
    zoomFactor: newZoomFactor,
  }).catch(() => {});
});
