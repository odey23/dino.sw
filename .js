// ==== IMPORT MODULE ====
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ==== INISIALISASI ====
const app = express();
const PORT = 3000;
const SECRET_KEY = "supersecretjwtkey123"; // ganti untuk production

// ==== MIDDLEWARE ====
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // file statis

// ==== KONEKSI DATABASE ====
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "dino_w",
});

db.connect((err) => {
  if (err) console.error("❌ Gagal konek MySQL:", err);
  else console.log("✅ Terhubung ke MySQL!");
});

// ==== MIDDLEWARE AUTENTIKASI TOKEN ====
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(403).json({ message: "Token tidak ditemukan" });

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Token tidak valid" });
    req.user = decoded;
    next();
  });
}

// ==== LOGIN ====
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Lengkapi username & password" });

  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).json({ message: "Kesalahan server" });
    if (results.length === 0)
      return res.status(404).json({ message: "User tidak ditemukan" });

    const user = results[0];
    const validPass = bcrypt.compareSync(password, user.password);
    if (!validPass) return res.status(401).json({ message: "Password salah" });

    const token = jwt.sign(
      { username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: "2h" }
    );

    res.json({ token, role: user.role, username: user.username });
  });
});

// ==== BUAT AKUN BARU ====
app.post("/api/register", async (req, res) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!username || !password)
    return res.status(400).json({ message: "Username dan password wajib diisi" });

  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username))
    return res.status(400).json({
      message: "Username harus 3-30 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus",
    });

  if (password.length < 8)
    return res.status(400).json({ message: "Password minimal 8 karakter" });

  try {
    const [existingUsers] = await db.promise().query(
      "SELECT username FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (existingUsers.length > 0)
      return res.status(409).json({ message: "Username sudah digunakan" });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.promise().query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, passwordHash, "user"]
    );

    return res.status(201).json({ message: "Akun berhasil dibuat. Silakan login." });
  } catch (err) {
    console.error("Gagal membuat akun:", err);

    if (err.code === "ER_DUP_ENTRY")
      return res.status(409).json({ message: "Username sudah digunakan" });

    return res.status(500).json({ message: "Gagal membuat akun. Coba lagi nanti." });
  }
});

// ==== API DEVICE REGISTER ====
app.post("/api/devices/register", (req, res) => {
  const { device_uuid, device_key, location } = req.body;
  if (!device_uuid || !device_key || !location)
    return res.status(400).json({ message: "Data tidak lengkap!" });

  const sql =
    "INSERT INTO devices (device_uuid, device_key, location) VALUES (?, ?, ?)";
  db.query(sql, [device_uuid, device_key, location], (err) => {
    if (err) {
      console.error("❌ Gagal menambah device:", err);
      return res.status(500).json({ message: "Gagal menyimpan device" });
    }
    res.json({ message: "✅ Device berhasil diregistrasi!" });
  });
});

// ==== API KIRIM DONASI ====
app.post("/api/donations", (req, res) => {
  const { amount, detected_by, metadata } = req.body;
  const device_uuid = req.headers["x-device-uuid"];
  const device_key = req.headers["x-device-key"];

  if (!device_uuid || !device_key)
    return res.status(401).json({ message: "❌ Device belum terautentikasi" });

  const sqlDevice =
    "SELECT * FROM devices WHERE device_uuid = ? AND device_key = ?";
  db.query(sqlDevice, [device_uuid, device_key], (err, results) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Kesalahan server saat cek device" });
    }
    if (results.length === 0)
      return res
        .status(403)
        .json({ message: "❌ Device tidak terdaftar atau salah key" });

    const sqlDonation =
      "INSERT INTO donations (device_uuid, amount, detected_by, metadata, created_at) VALUES (?, ?, ?, ?, NOW())";
    db.query(
      sqlDonation,
      [device_uuid, amount, detected_by, JSON.stringify(metadata)],
      (err2) => {
        if (err2) {
          console.error("❌ Gagal menyimpan donasi:", err2);
          return res.status(500).json({ message: "Gagal menyimpan donasi" });
        }
        res.json({ message: "✅ Donasi berhasil disimpan!" });
      }
    );
  });
});

// ==== API LIHAT DONASI ====
app.get("/api/donations", verifyToken, (req, res) => {
  const sql = "SELECT * FROM donations ORDER BY created_at DESC LIMIT 100";
  db.query(sql, (err, results) => {
    if (err)
      return res.status(500).json({ message: "Gagal mengambil data donasi" });
    res.json(results);
  });
});

// ==== API EXPORT DATA (admin only) ====
app.get("/api/export", verifyToken, (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Akses ditolak, hanya admin!" });

  const sql = "SELECT * FROM donations ORDER BY created_at DESC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Gagal export data" });
    res.json({
      message: "✅ Data berhasil diexport",
      data: results,
    });
  });
});

// ==== ROUTES FRONTEND ====
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/dashboard", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);

app.get("/stats", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "stats.html"))
);

app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);

// ==== FALLBACK ====
app.use((req, res) => res.redirect("/"));

// ==== JALANKAN SERVER ====
app.listen(PORT, () =>
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`)
);
