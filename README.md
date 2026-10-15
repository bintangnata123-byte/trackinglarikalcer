# ⚡ Stride Challenge - Running Tracker Website (Multi-User & SQLite Database)

Aplikasi web pelacak lari personal & komunitas dengan tampilan antarmuka gelap modern (*dark athletic neon theme*) berstandar Stride Indonesia. Dilengkapi dengan sistem autentikasi multi-pengguna (login & registrasi) dan penyimpanan database SQLite lokal yang aman dan persisten.

---

## 🏃 Fitur Utama

1. **Database Relasional SQLite (`tracker.db`)**:
   - Menyimpan seluruh data pelari, target lari, dan riwayat sesi harian secara permanen.
   - Menggunakan modul bawaan Node.js (`node:sqlite`) yang cepat, stabil, tanpa konfigurasi tambahan.
   - Tabel: `users`, `run_sessions`, dan `auth_sessions`.

2. **Sistem Autentikasi & Multi-Pengguna**:
   - **Halaman Masuk (Login)**: Masuk menggunakan username atau email dan kata sandi.
   - **Halaman Registrasi**: Pendaftaran pelari baru lengkap dengan Nama, Username, Kata Sandi, Target Jarak KM (5K, 10K, 21K Half Marathon, 42K Marathon, atau custom), dan Nomor BIB otomatis.
   - Enkripsi kata sandi yang aman menggunakan `PBKDF2` + `Salt` 100.000 iterasi.
   - Sesi login aman menggunakan cookie HTTP-Only (aktif 30 hari).
   - Tombol cepat **Login Demo** (Reni Mailinar) untuk mencoba langsung data sesuai tampilan awal.

3. **Dashboard Pelacak Lari Interaktif**:
   - **Header & Profil Personal**: Menampilkan nama pelari, inisial avatar, nomor BIB, dan kategori tantangan sesuai pengguna yang login.
   - **Total Target KM yang Dapat Diubah**: Klik tombol `✏️ Ubah` pada kartu Total Target untuk menyesuaikan target KM. Nilai baru langsung tersimpan ke database.
   - **Statistik Otomatis**: Akumulasi Jarak (KM), Persentase Selesai, Sisa Target, Rata-rata Pace (`MM'SS"/KM`), dan Frekuensi Lari.
   - **Visual Lintasan Telemetri Real-Time**: Garis progres lintasan 0-100% dengan 5 titik *checkpoint* dinamis (*Start, Warm-up, Halfway, The Wall, Finisher*).
   - **Analisis Konsistensi Split Pace**: Kartu perbandingan pace tiap sesi dengan lencana otomatis untuk sesi tercepat ⚡.
   - **Formulir Catat Lari Harian**: Input tanggal, jarak (KM), menit & detik dengan pratinjau kalkulasi pace otomatis dan simpan instan ke database.
   - **Tabel Riwayat Sesi Lari**: Menampilkan riwayat sesi lengkap dengan opsi hapus (🗑️) jika terjadi kesalahan input.
   - **Papan Peringkat Tantangan (Leaderboard)**: Modal interaktif untuk melihat peringkat seluruh pelari yang terdaftar di database.

---

## 🚀 Cara Menjalankan Aplikasi

### Opsi 1: Klik Dua Kali File `start.bat` (Termudah di Windows)
Cukup klik dua kali file **`start.bat`** di folder project ini.

### Opsi 2: Menggunakan Terminal / PowerShell
Jalankan perintah berikut:
```bash
npm start
```
Atau:
```bash
node server.js
```

Setelah server aktif, buka browser dan akses:
👉 **[http://localhost:4000](http://localhost:4000)**

---

## 👤 Akun Bawaan (Demo)

Untuk melihat tampilan yang persis dengan rancangan awal dan foto terlampir (9.59 KM dari target 10 KM):
- **Username**: `reni`
- **Password**: `password123`
*(Atau klik tombol "Masuk sebagai Reni Mailinar (Demo)" di halaman login)*

Anda juga dapat mendaftar akun baru dengan mengklik tab **Daftar Baru** pada halaman login.

---

## 📁 Struktur File Project

```text
Tracker Lari/
├── public/
│   ├── index.html        # Halaman dashboard pelacak lari (terkoneksi database)
│   └── login.html        # Halaman autentikasi (Login & Registrasi pelari)
├── db.js                 # Inisialisasi SQLite database (tabel, seeding, enkripsi)
├── server.js             # Server Express backend & REST API
├── start.bat             # Skrip instan untuk menjalankan server di Windows
├── tracker.db            # File database SQLite (tersimpan otomatis)
├── package.json          # Konfigurasi dependensi project
└── README.md             # Dokumentasi panduan penggunaan
```
