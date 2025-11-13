const tableBody = document.querySelector("#donationTable tbody");
const totalElement = document.querySelector("#total");

async function fetchDonations() {
  try {
    const res = await fetch("http://localhost:3000/api/donations");
    if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
    const data = await res.json();

    // Kosongkan tabel
    tableBody.innerHTML = "";

    let total = 0;
    data.forEach((item, index) => {
      total += Number(item.amount);
      const row = `
        <tr>
          <td>${index + 1}</td>
          <td>${item.device_uuid}</td>
          <td>Rp ${Number(item.amount).toLocaleString("id-ID")}</td>
          <td>${item.detected_by}</td>
          <td>${new Date(item.created_at).toLocaleString("id-ID")}</td>
        </tr>
      `;
      tableBody.insertAdjacentHTML("beforeend", row);
    });

    totalElement.textContent = `Rp ${total.toLocaleString("id-ID")}`;
  } catch (err) {
    console.error("❌ Gagal memuat data:", err);
  }
}

fetchDonations();
setInterval(fetchDonations, 1000); // update tiap 1 detik
