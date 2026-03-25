const FEED_PATTERNS = [
  {
    site: "linkedin",
    pattern: /^https:\/\/www\.linkedin\.com\/feed\/(?!notifications\/)(\?.*)?$/,
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

function checkAndRedirect(tabId, url) {
  for (const { pattern, redirect } of FEED_PATTERNS) {
    if (pattern.test(url)) {
      chrome.tabs.update(tabId, { url: redirect });
      return;
    }
  }
}
