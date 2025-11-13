// ==== AMBIL TOKEN LOGIN ====
const authToken = localStorage.getItem("token");
if (!authToken) {
  window.location.href = "/";
}

const tableBody = document.querySelector("#donationTableBody");
const totalElement = document.querySelector("#totalDonasi");

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
      window.location.href = "/";
      return;
    }

    if (!res.ok) throw new Error(`HTTP error! ${res.status}`);

    const data = await res.json();
    
    // Kosongkan tabel sebelum diisi ulang
    tableBody.innerHTML = "";
    let total = 0;

    data.forEach((item) => {
      total += Number(item.amount);
      
      // Gunakan fungsi format tanggal yang konsisten
      const formattedDate = formatDateLocal(item.created_at);
      
      const row = `
        <tr>
          <td>${formattedDate}</td>
          <td>${item.device_uuid}</td>
          <td>${item.detected_by}</td>
          <td>Rp ${Number(item.amount).toLocaleString("id-ID")}</td>
        </tr>`;
      tableBody.insertAdjacentHTML("beforeend", row);
    });

    totalElement.textContent = `Rp ${total.toLocaleString("id-ID")}`;
  } catch (err) {
    console.error("❌ Gagal memuat data:", err);
  }
}

// ==== AUTO REFRESH DATA SETIAP DETIK ====
fetchDonations();
setInterval(fetchDonations, 1000);