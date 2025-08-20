const PREFS_KEY = "uiPrefs";
let myChart = null;
let chartType = "bar";      
let sortOption = "time";   
let currentTab = "today";   
const SETTINGS_KEY = "settings";

function loadPrefs() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([PREFS_KEY], (res) => {
      const defaults = { chartType: "bar", sortOption: "time", activeTab: "today" };
      const saved = res[PREFS_KEY] || {};
      resolve({ ...defaults, ...saved });
    });
  });
}

async function loadSettings() {
  return new Promise(res => chrome.storage.sync.get([SETTINGS_KEY], r => {
    res({
      enableLimit: false,
      limitMins: 120,
      enableBlock: false,
      focusMode: false,
      focusSites: "",
      ...(r[SETTINGS_KEY] || {})
    });
  }));
}

function saveSettings(s) {
  chrome.storage.sync.set({ [SETTINGS_KEY]: s });
}

function paintProgress(totalMinutes, limitMins, enabled) {
  const bar = document.getElementById("limit-bar");
  const lbl = document.getElementById("limit-label");
  const pct = enabled && limitMins > 0 ? Math.min(100, Math.round((totalMinutes / limitMins) * 100)) : 0;
  bar.style.width = pct + "%";
  bar.className = "h-2 rounded " + (pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-orange-500" : "bg-blue-500");
  lbl.textContent = `${totalMinutes.toFixed(1)} / ${enabled ? limitMins : 0} mins`;
}

function savePrefs() {
  const toSave = { chartType, sortOption, activeTab: currentTab };
  chrome.storage.sync.set({ [PREFS_KEY]: toSave });
}

function updateTabUI(activeTab) {
  ["today", "week", "month"].forEach((tab) => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;
    if (tab === activeTab) {
      btn.classList.add("bg-blue-500");
      btn.classList.remove("bg-gray-500");
    } else {
      btn.classList.add("bg-gray-500");
      btn.classList.remove("bg-blue-500");
    }
  });
}

function setChartButtonsUI() {
  const barBtn = document.getElementById("chart-bar");
  const pieBtn = document.getElementById("chart-pie");
  if (!barBtn || !pieBtn) return;

  if (chartType === "bar") {
    barBtn.classList.add("bg-blue-500");
    barBtn.classList.remove("bg-gray-700");
    pieBtn.classList.add("bg-gray-700");
    pieBtn.classList.remove("bg-blue-500");
  } else {
    pieBtn.classList.add("bg-blue-500");
    pieBtn.classList.remove("bg-gray-700");
    barBtn.classList.add("bg-gray-700");
    barBtn.classList.remove("bg-blue-500");
  }
}

function setSortSelectUI() {
  const select = document.getElementById("sort-option");
  if (select) select.value = sortOption;
}

function setSummaryLabelScope() {
  const summary = document.querySelector("#summary p");
  if (!summary) return;
  const scope =
    currentTab === "today" ? "today" :
    currentTab === "week" ? "this week" : "this month";
  summary.innerHTML = `You've spent <span id="today-time" class="font-medium">loading...</span> online ${scope}.`;
}

function loadData(tab) {
  if (tab === "today") {
    const todayKey = new Date().toISOString().split("T")[0];
    fetchAndRender(todayKey);
  } else if (tab === "week") {
    fetchWeekData();
  } else if (tab === "month") {
    fetchMonthData();
  }
}

function fetchAndRender(key) {
  chrome.storage.local.get([key], (result) => {
    const data = result[key] || {};
    renderChart(data);
  });
}

function fetchWeekData() {
  chrome.storage.local.get(null, (result) => {
    const today = new Date();
    const weekData = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayData = result[key] || {};
      for (const site in dayData) {
        weekData[site] = (weekData[site] || 0) + dayData[site];
      }
    }
    renderChart(weekData);
  });
}

function fetchMonthData() {
  chrome.storage.local.get(null, (result) => {
    const today = new Date();
    const monthData = {};
    const month = today.getMonth();
    const year = today.getFullYear();

    for (const key in result) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue; 
      const [y, m] = key.split("-").map(Number);
      if (y === year && m - 1 === month) {
        const dayData = result[key] || {};
        for (const site in dayData) {
          monthData[site] = (monthData[site] || 0) + dayData[site];
        }
      }
    }
    renderChart(monthData);
  });
}

function renderChart(data) {
  let entries = Object.entries(data).map(([site, seconds]) => [site, +(seconds / 60).toFixed(1)]);

  if (sortOption === "time") {
    entries.sort((a, b) => b[1] - a[1]);
  } else if (sortOption === "name") {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  let topEntries = entries.slice(0, 5);
  if (entries.length > 5 && sortOption === "time" && chartType !== "pie") {
    const otherMinutes = entries.slice(5).reduce((sum, e) => sum + e[1], 0);
    topEntries.push(["Other", +otherMinutes.toFixed(1)]);
  }

  const labels = topEntries.map((e) => e[0]);
  const values = topEntries.map((e) => e[1]);

  const totalMinutes = values.reduce((sum, val) => sum + val, 0);
  
  const totalEl = document.getElementById("today-time");
  if (totalEl) totalEl.textContent = `${totalMinutes.toFixed(1)} mins`;
  loadSettings().then(s => paintProgress(totalMinutes, s.limitMins, s.enableLimit));
  createChart(labels, values);
}

function createChart(labels, data) {
  const ctx = document.getElementById("usageChart").getContext("2d");
  if (myChart) myChart.destroy();

  const colors = [
    "#3B82F6", "#F97316", "#10B981",
    "#EF4444", "#A855F7", "#FBBF24"
  ];
  const chartColors = labels.map((_, i) => colors[i % colors.length]);

  myChart = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [{
        label: chartType === "bar" ? "Minutes Spent" : "",
        data,
        backgroundColor: chartColors
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: chartType === "pie" } },
      scales: chartType === "bar" ? { y: { beginAtZero: true } } : {}
    }
  });
}

document.getElementById("open-settings").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const prefs = await loadPrefs();
  chartType = prefs.chartType;
  sortOption = prefs.sortOption;
  currentTab = prefs.activeTab;

  ["today", "week", "month"].forEach((tab) => {
    const el = document.getElementById(`tab-${tab}`);
    if (!el) return;
    el.addEventListener("click", () => {
      currentTab = tab;
      updateTabUI(currentTab);
      setSummaryLabelScope();
      savePrefs();
      loadData(currentTab);
    });
  });

  const barBtn = document.getElementById("chart-bar");
  const pieBtn = document.getElementById("chart-pie");
  if (barBtn) {
    barBtn.addEventListener("click", () => {
      chartType = "bar";
      setChartButtonsUI();
      savePrefs();
      loadData(currentTab);
    });
  }
  if (pieBtn) {
    pieBtn.addEventListener("click", () => {
      chartType = "pie";
      setChartButtonsUI();
      savePrefs();
      loadData(currentTab);
    });
  }

  const sortSelect = document.getElementById("sort-option");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      sortOption = e.target.value;
      savePrefs();
      loadData(currentTab);
    });
  }

  updateTabUI(currentTab);
  setChartButtonsUI();
  setSortSelectUI();
  setSummaryLabelScope();

  loadData(currentTab);
});
