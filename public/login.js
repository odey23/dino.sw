document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const message = document.getElementById("message");
  const loginBtn = document.getElementById("loginBtn");

  // Bersihkan pesan sebelumnya
  message.textContent = "";

  // Cek input kosong
  if (!username || !password) {
    message.textContent = "Username dan password wajib diisi!";
    return;
  }

  // Nonaktifkan tombol sementara
  loginBtn.disabled = true;
  loginBtn.textContent = "Memproses...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.message || "Login gagal!";
    } else {
      // Simpan token dan role ke localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);

      // Redirect ke dashboard
      window.location.href = "/dashboard";
    }
  } catch (err) {
    console.error("Login error:", err);
    message.textContent = "⚠️ Tidak bisa terhubung ke server!";
  } finally {
    // Aktifkan kembali tombol
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});
