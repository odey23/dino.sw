// ==== AMBIL TOKEN LOGIN ====
const authToken = localStorage.getItem("token");
if (!authToken) {
  window.location.href = "login.html";
}

const tableBody = document.querySelector("#donationTableBody");
const totalElement = document.querySelector("#totalDonasi");
let allDonationData = []; // Cache for all data
let filteredData = []; // Current filtered data
let barChart = null;
let pieChart = null;
let currentStartDate = null;
let currentEndDate = null;

// ==== FUNGSI HELPER: FORMAT TANGGAL KONSISTEN ====
function formatDateLocal(dateString) {
  const date = new Date(dateString);
  // Gunakan getFullYear, getMonth, getDate untuk waktu lokal
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// ==== FUNGSI UNTUK MENGAMBIL DATA DONASI ====
async function fetchDonations() {
  try {
    const res = await fetch("/api/donations", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // ==== CEK TOKEN TIDAK VALID ====
    if (res.status === 401 || res.status === 403) {
      console.warn("Token tidak valid atau kadaluarsa. Logout otomatis...");
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error! ${res.status}`);

    const data = await res.json();

    // Cache all data with parsed dates
    allDonationData = data.map(item => ({
      ...item,
      dateObj: new Date(item.created_at),
      amount: Number(item.amount)
    }));

    // Apply current filter
    applyFilter();
  } catch (err) {
    console.error("❌ Gagal memuat data:", err);
  }
}

// ==== FILTERING LOGIC ====
function setFilter(button, filterType) {
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');

  // Show/hide date range
  const dateRange = document.getElementById('dateRangeContainer');
  dateRange.style.display = filterType === 'daily' ? 'flex' : 'none';

  // Apply filter
  applyFilter();
}

function applyFilter() {
  const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
  const now = new Date();

  if (activeFilter === 'daily') {
    const start = new Date(document.getElementById('startDate').value);
    const end = new Date(document.getElementById('endDate').value);
    if (!isNaN(start) && !isNaN(end)) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      currentStartDate = new Date(start);
      currentEndDate = new Date(end);
      filteredData = allDonationData.filter(item => item.dateObj >= start && item.dateObj <= end);
    } else {
      currentStartDate = null;
      currentEndDate = null;
      filteredData = allDonationData;
    }
  } else if (activeFilter === 'weekly') {
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    currentStartDate = null;
    currentEndDate = null;
    filteredData = allDonationData.filter(item => item.dateObj >= weekStart);
  } else if (activeFilter === 'monthly') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentStartDate = null;
    currentEndDate = null;
    filteredData = allDonationData.filter(item => item.dateObj >= monthStart);
  } else if (activeFilter === 'yearly') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    currentStartDate = null;
    currentEndDate = null;
    filteredData = allDonationData.filter(item => item.dateObj >= yearStart);
  } else {
    currentStartDate = null;
    currentEndDate = null;
    filteredData = allDonationData;
  }

  updateTableAndStats();
  renderCharts();
}

// ==== UPDATE TABLE AND STATS ====
function updateTableAndStats() {
  // Update table
  tableBody.innerHTML = "";
  let total = 0;
  const devices = new Set();

  filteredData.forEach((item) => {
    total += item.amount;
    devices.add(item.device_uuid);

    const formattedDate = formatDateLocal(item.created_at);
    const row = `
      <tr data-iso-date="${item.created_at}">
        <td>${formattedDate}</td>
        <td>${item.device_uuid}</td>
        <td>${item.detected_by}</td>
        <td>Rp ${item.amount.toLocaleString("id-ID")}</td>
      </tr>`;
    tableBody.insertAdjacentHTML("beforeend", row);
  });

  // Update stats
  totalElement.textContent = `Rp ${total.toLocaleString("id-ID")}`;
  document.getElementById('totalTransaksi').textContent = filteredData.length;
  document.getElementById('deviceAktif').textContent = devices.size;
}

// ==== RENDER CHARTS ====
function renderCharts() {
  const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');

  // Bar Chart: Donations over time
  let barLabels = [];
  let barData = [];
  let barLabel = 'Total Donations';

  if (activeFilter === 'weekly') {
    // For weekly, show daily bars for the 7 days
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const dailyTotals = {};
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dailyTotals[dateKey] = 0;
    }

    filteredData.forEach(item => {
      const dateKey = item.dateObj.toISOString().split('T')[0];
      if (dailyTotals.hasOwnProperty(dateKey)) {
        dailyTotals[dateKey] += item.amount;
      }
    });

    barLabels = Object.keys(dailyTotals).sort();
    barData = barLabels.map(date => dailyTotals[date]);
    barLabel = 'Daily Donations (This Week)';
  } else if (activeFilter === 'daily' && currentStartDate && currentEndDate) {
    // For daily with date range, show bars for every day in the range
    const dailyTotals = {};
    for (let d = new Date(currentStartDate); d <= currentEndDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      dailyTotals[dateKey] = 0;
    }

    filteredData.forEach(item => {
      const dateKey = item.dateObj.toISOString().split('T')[0];
      if (dailyTotals.hasOwnProperty(dateKey)) {
        dailyTotals[dateKey] += item.amount;
      }
    });

    barLabels = Object.keys(dailyTotals).sort();
    barData = barLabels.map(date => dailyTotals[date]);
    barLabel = 'Daily Donations';
  } else {
    // Default: daily aggregation for other filters
    const dailyTotals = {};
    filteredData.forEach(item => {
      const dateKey = item.dateObj.toISOString().split('T')[0];
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + item.amount;
    });

    barLabels = Object.keys(dailyTotals).sort();
    barData = barLabels.map(date => dailyTotals[date]);
  }

  if (barChart) barChart.destroy();
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: barLabel,
        data: barData,
        backgroundColor: 'rgba(92, 184, 92, 0.6)',
        borderColor: 'rgba(92, 184, 92, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `Rp ${c.parsed.y.toLocaleString("id-ID")}` } },
        datalabels: {
          formatter: (value) => {
            const total = barData.reduce((a,b)=>a+b,0);
            return total === 0 ? '0%' : `${((value / total) * 100).toFixed(1)}%`;
          },
          color: '#fff',
          font: { weight: 'bold' }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => `Rp ${v.toLocaleString("id-ID")}` } }
      }
    },
    plugins: [ChartDataLabels]
  });

  // Pie Chart: Donations by device (disable animation to fix bug)
  const deviceTotals = {};
  filteredData.forEach(item => {
    deviceTotals[item.device_uuid] = (deviceTotals[item.device_uuid] || 0) + item.amount;
  });

  if (pieChart) pieChart.destroy();
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(deviceTotals),
      datasets: [{
        data: Object.values(deviceTotals),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      animation: false, // Disable animation to fix bug
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (c) => `${c.label}: Rp ${c.parsed.toLocaleString("id-ID")}` } },
        datalabels: {
          formatter: (value, ctx) => {
            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            return sum === 0 ? '0%' : `${((value * 100) / sum).toFixed(1)}%`;
          },
          color: '#fff',
          font: { weight: 'bold', size: 14 }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ==== EXPORT TO CSV ====
function exportToCSV() {
  let csvContent = "data:text/csv;charset=utf-8,Tanggal,Device,Warna,Nominal\r\n";
  filteredData.forEach(item => {
    const formattedDate = formatDateLocal(item.created_at);
    const row = `"${formattedDate}","${item.device_uuid}","${item.detected_by}","Rp ${item.amount.toLocaleString("id-ID")}"`;
    csvContent += row + "\r\n";
  });

  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", "dino_wallet_donations.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==== INITIAL LOAD ====
fetchDonations();
setInterval(fetchDonations, 1000);
