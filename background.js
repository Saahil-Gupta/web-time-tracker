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

        chrome.storage.local.set({ [today]: data });
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
