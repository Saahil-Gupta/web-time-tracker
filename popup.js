document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get([today], (result) => {
    const data = result[today] || {};
    const labels = Object.keys(data);
    const values = Object.values(data).map(seconds => (seconds / 60).toFixed(1)); // minutes

    createChart(labels, values);
  });
});

function createChart(labels, data) {
  const ctx = document.getElementById('usageChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes Spent',
        data: data,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}