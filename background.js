console.log("Background service worker has started and is firing.");

let currentTabId = null;
let currentDomain = null;
let startTime = null;

function getDomainFromUrl(url) {
    try {
        const { hostname } = new URL(url);
        return hostname;
    } catch {
        return null;
    }
}

async function saveTimeSpent(domain, timeSpent) {
    if (!domain || timeSpent <= 0) return;
    console.log("Saving time:", domain, timeSpent, "seconds");
    const today = new Date().toISOString().split('T')[0];

    chrome.storage.local.get([today], (result) => {
        const data = result[today] || {};
        data[domain] = (data[domain] || 0) + timeSpent;

        chrome.storage.local.set({ [today]: data }, afterSaveTick);
    });
}

function handleTabUpdate(tabId, url) {
    const now = Date.now();
    if (startTime && currentDomain) {
        const timeSpent = Math.floor((now - startTime) / 1000);
        saveTimeSpent(currentDomain, timeSpent);
    }

    currentTabId = tabId;
    currentDomain = getDomainFromUrl(url);
    startTime = now;
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        if (tab.active && tab.url) {
        handleTabUpdate(tabId, tab.url);
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.url) {
        handleTabUpdate(tabId, changeInfo.url);
    }
});

chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === "idle" || newState === "locked") {
        const now = Date.now();
        if (startTime && currentDomain) {
        const timeSpent = Math.floor((now - startTime) / 1000);
        saveTimeSpent(currentDomain, timeSpent);
        }

        currentTabId = null;
        currentDomain = null;
        startTime = null;
    }
});

function todayKey() {
    return new Date().toISOString().split("T")[0];
}

function sumTodayMinutes(cb) {
    const key = todayKey();
    chrome.storage.local.get([key], (res) => {
        const obj = res[key] || {};
        const totalSec = Object.values(obj).reduce((s, v) => s + (v || 0), 0);
        cb(totalSec / 60);
    });
}

function getSettings(cb) {
    chrome.storage.sync.get(["settings"], (r) => {
        const s = r.settings || {};
        cb({
        enableLimit: !!s.enableLimit,
        limitMins: Number.isFinite(s.limitMins) ? s.limitMins : 120,
        enableBlock: !!s.enableBlock,
        focusMode: !!s.focusMode,
        focusSites: s.focusSites || ""
        });
    });
}

function notify(id, title, message) {
    if (chrome.notifications && typeof chrome.notifications.create === "function") {
        chrome.notifications.create(id, {
        type: "basic",
        iconUrl: "icons/icon.png",
        title,
        message
        });
    }
}

async function setBlockedHosts(hosts) {
    const rules = hosts.filter(Boolean).map((host, i) => ({
        id: 10_000 + i,
        priority: 1,
        action: { type: "block" },
        condition: { urlFilter: `||${host}`, resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] }
    }));

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const toRemove = existing.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove, addRules: rules });
}

async function refreshRules() {
    getSettings((s) => {
        sumTodayMinutes(async (mins) => {
        const overLimit = s.enableLimit && mins >= s.limitMins;
        let blockList = [];

        if (s.focusMode) {
            blockList = s.focusSites.split(",").map(x => x.trim()).filter(Boolean);
        }

        if (overLimit && s.enableBlock) {
            blockList = blockList.concat(s.focusSites.split(",").map(x => x.trim()).filter(Boolean));
            notify("limit_reached", "Daily limit reached", "Take a break. Focus mode will block distracting sites.");
        }

        await setBlockedHosts([...new Set(blockList)]);
        });
    });
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "refreshRules") {
        refreshRules();
    }
});

async function afterSaveTick() {
    refreshRules();
}

chrome.tabs.onActivated.addListener(() => refreshRules());
chrome.idle.onStateChanged.addListener(() => refreshRules());

chrome.alarms.create("midnightReset", { when: Date.now() + 1000, periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === "midnightReset") refreshRules();
});
