const SETTINGS_KEY = "settings";

function loadSettings() {
    return new Promise(res => {
        chrome.storage.sync.get([SETTINGS_KEY], r => {
        res({
            enableLimit: false,
            limitMins: 120,
            enableBlock: false,
            focusMode: false,
            focusSites: "",
            ...(r[SETTINGS_KEY] || {})
        });
        });
    });
}

function saveSettings(s) {
    chrome.storage.sync.set({ [SETTINGS_KEY]: s }, () => {
        if (chrome.runtime.lastError) {
        setStatus("Error saving settings: " + chrome.runtime.lastError.message, true);
        } else {
        setStatus("Saved", false);
        chrome.runtime.sendMessage({ type: "refreshRules" });
        }
    });
}

function setStatus(msg, isError) {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = "text-xs " + (isError ? "text-red-400" : "text-slate-400");
    setTimeout(() => (el.textContent = ""), 2000);
    }

    document.addEventListener("DOMContentLoaded", async () => {
    const enableLimitEl = document.getElementById("enable-limit");
    const limitMinsEl   = document.getElementById("limit-mins");
    const enableBlockEl = document.getElementById("enable-block");
    const focusModeEl   = document.getElementById("focus-mode");
    const focusSitesEl  = document.getElementById("focus-sites");
    const exportBtn     = document.getElementById("export-json");
    const clearBtn      = document.getElementById("clear-data");

    const s = await loadSettings();
    enableLimitEl.checked = s.enableLimit;
    limitMinsEl.value = s.limitMins;
    enableBlockEl.checked = s.enableBlock;
    focusModeEl.checked = s.focusMode;
    focusSitesEl.value = s.focusSites;

    function commit() {
        const next = {
        enableLimit: enableLimitEl.checked,
        limitMins: Math.max(10, parseInt(limitMinsEl.value || "0", 10)),
        enableBlock: enableBlockEl.checked,
        focusMode: focusModeEl.checked,
        focusSites: focusSitesEl.value.trim()
        };
        saveSettings(next);
    }

    [enableLimitEl, enableBlockEl, focusModeEl].forEach(el => el.addEventListener("change", commit));
    limitMinsEl.addEventListener("input", commit);
    focusSitesEl.addEventListener("change", commit);

    exportBtn.addEventListener("click", async () => {
        chrome.storage.local.get(null, (result) => {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        chrome.downloads?.download
            ? chrome.downloads.download({ url, filename: "web-time-tracker.json" })
            : window.open(url, "_blank");
        setStatus("Exported data", false);
        });
    });

    clearBtn.addEventListener("click", () => {
        if (!confirm("Clear all stored usage data for all days?")) return;
        chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
            setStatus("Error clearing data: " + chrome.runtime.lastError.message, true);
        } else {
            setStatus("Cleared data", false);
            chrome.runtime.sendMessage({ type: "refreshRules" });
        }
        });
    });
});
