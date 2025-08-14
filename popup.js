let myChart = null;
let chartType = "bar"; // default
let sortOption = "time"; // default

document.addEventListener("DOMContentLoaded", () => {
  const tabs = ["today", "week", "month"];
  let currentTab = "today";

  tabs.forEach(tab => {
    document.getElementById(`tab-${tab}`).addEventListener("click", () => {
      currentTab = tab;
      updateTabUI(tab);
      loadData(tab);
    });
  });

  // Chart type buttons
  document.getElementById("chart-bar").addEventListener("click", () => {
    chartType = "bar";
    loadData(currentTab);
  });

  document.getElementById("chart-pie").addEventListener("click", () => {
    chartType = "pie";
    loadData(currentTab);
  });

  // Sorting dropdown
  document.getElementById("sort-option").addEventListener("change", (e) => {
    sortOption = e.target.value;
    loadData(currentTab);
  });

  updateTabUI(currentTab);
  loadData(currentTab);
});

function updateTabUI(activeTab) {
  ["today", "week", "month"].forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (tab === activeTab) {
      btn.classList.add("bg-blue-500");
      btn.classList.remove("bg-gray-500");
    } else {
      btn.classList.add("bg-gray-500");
      btn.classList.remove("bg-blue-500");
    }
  });
}

function loadData(tab) {
  if (tab === "today") {
    const todayKey = new Date().toISOString().split('T')[0];
    fetchAndRender(todayKey);
  } else if (tab === "week") {
    fetchWeekData();
  } else if (tab === "month") {
    fetchMonthData();
  }
}

function fetchAndRender(key) {
  chrome.storage.local.get([key], result => {
    const data = result[key] || {};
    renderChart(data);
  });
}

function fetchWeekData() {
  chrome.storage.local.get(null, result => {
    const today = new Date();
    const weekData = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayData = result[key] || {};

      for (const site in dayData) {
        weekData[site] = (weekData[site] || 0) + dayData[site];
      }
    }
    renderChart(weekData);
  });
}

function fetchMonthData() {
  chrome.storage.local.get(null, result => {
    const today = new Date();
    const monthData = {};
    const month = today.getMonth();
    const year = today.getFullYear();

    for (const key in result) {
      const [y, m] = key.split("-").map(Number);
      if (y === year && m - 1 === month) {
        const dayData = result[key];
        for (const site in dayData) {
          monthData[site] = (monthData[site] || 0) + dayData[site];
        }
      }
    }
    renderChart(monthData);
  });
}

function renderChart(data) {
  let entries = Object.entries(data).map(([site, seconds]) => [site, (seconds / 60).toFixed(1)]);

  // Apply sorting
  if (sortOption === "time") {
    entries.sort((a, b) => b[1] - a[1]);
  } else if (sortOption === "name") {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  let topEntries = entries.slice(0, 5);
  if (entries.length > 5 && sortOption === "time") {
    const otherMinutes = entries.slice(5).reduce((sum, e) => sum + parseFloat(e[1]), 0);
    topEntries.push(["Other", otherMinutes.toFixed(1)]);
  }

  const labels = topEntries.map(e => e[0]);
  const values = topEntries.map(e => e[1]);

  const totalMinutes = values.reduce((sum, val) => sum + parseFloat(val), 0);
  document.getElementById("today-time").textContent = `${totalMinutes.toFixed(1)} mins`;

  createChart(labels, values);
}

function createChart(labels, data) {
  const ctx = document.getElementById('usageChart').getContext('2d');
  if (myChart) myChart.destroy();

  const colors = [
    '#3B82F6', '#F97316', '#10B981',
    '#EF4444', '#A855F7', '#FBBF24'
  ];
  const chartColors = labels.map((_, i) => colors[i % colors.length]);

  myChart = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [{
        label: chartType === "bar" ? 'Minutes Spent' : '',
        data,
        backgroundColor: chartColors
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: chartType === "pie" }
      },
      scales: chartType === "bar" ? {
        y: { beginAtZero: true }
      } : {}
    }
  });
}
