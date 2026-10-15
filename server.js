const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('node:crypto');
const path = require('node:path');
const { db, hashPassword, verifyPassword } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
  const token = req.cookies?.stride_session || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (!token) {
    return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const session = db.prepare(`
    SELECT s.token, u.id, u.username, u.email, u.name, u.bib_number, u.target_km, u.category, u.created_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now);

  if (!session) {
    res.clearCookie('stride_session');
    return res.status(401).json({ error: 'Sesi telah kedaluwarsa. Silakan login kembali.' });
  }

  req.user = session;
  next();
}

// ---------------- AUTH API ROUTES ----------------

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, username, email, password, target_km, bib_number } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Nama, username, dan kata sandi wajib diisi.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (existingUser) {
      return res.status(400).json({ error: 'Username ini sudah digunakan. Silakan pilih username lain.' });
    }

    // Check email if provided
    if (email && email.trim()) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email.trim());
      if (existingEmail) {
        return res.status(400).json({ error: 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.' });
      }
    }

    // Auto-generate BIB if not provided
    const targetKmVal = parseFloat(target_km) > 0 ? parseFloat(target_km) : 10.0;
    const finalBib = (bib_number && bib_number.trim()) 
      ? (bib_number.startsWith('#') ? bib_number.trim() : `#${bib_number.trim()}`)
      : `#BIB-${Math.floor(10000 + Math.random() * 90000)}`;
    const category = `KATEGORI ${Math.round(targetKmVal)}K OPEN`;

    const { hash, salt } = hashPassword(password);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, password_salt, name, bib_number, target_km, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertUser.run(
      username.trim(),
      email ? email.trim() : null,
      hash,
      salt,
      name.trim(),
      finalBib,
      targetKmVal,
      category
    );

    const userId = Number(result.lastInsertRowid);

    // Create session token (valid 30 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    db.prepare('INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);

    res.cookie('stride_session', token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      message: 'Registrasi berhasil! Selamat bergabung di Stride Challenge.',
      user: {
        id: userId,
        username: username.trim(),
        name: name.trim(),
        bib_number: finalBib,
        target_km: targetKmVal,
        category
      }
    });
  } catch (err) {
    console.error('Error during register:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem saat registrasi: ' + err.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email dan kata sandi wajib diisi.' });
    }

    const trimmed = username.trim();
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(trimmed, trimmed);

    if (!user) {
      return res.status(401).json({ error: 'Username atau kata sandi tidak ditemukan.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Kata sandi tidak sesuai. Silakan coba lagi.' });
    }

    // Create session token (valid 30 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    db.prepare('INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

    res.cookie('stride_session', token, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    });

    return res.json({
      success: true,
      message: 'Login berhasil!',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        bib_number: user.bib_number,
        target_km: user.target_km,
        category: user.category
      }
    });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem saat login: ' + err.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  try {
    const token = req.cookies?.stride_session || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
    if (token) {
      db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    }
    res.clearCookie('stride_session');
    return res.json({ success: true, message: 'Anda telah berhasil keluar.' });
  } catch (err) {
    res.clearCookie('stride_session');
    return res.json({ success: true });
  }
});

// Get Current User Profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      name: req.user.name,
      bib_number: req.user.bib_number,
      target_km: req.user.target_km,
      category: req.user.category
    }
  });
});

// ---------------- USER TARGET API ----------------

// Update User Target KM
app.patch('/api/user/target', requireAuth, (req, res) => {
  try {
    const { target_km } = req.body;
    const num = parseFloat(target_km);
    if (!num || num <= 0 || num > 500) {
      return res.status(400).json({ error: 'Target jarak lari harus antara 1 sampai 500 KM.' });
    }

    const rounded = parseFloat(num.toFixed(2));
    const newCategory = `KATEGORI ${Math.round(rounded)}K OPEN`;
    db.prepare('UPDATE users SET target_km = ?, category = ? WHERE id = ?').run(rounded, newCategory, req.user.id);

    return res.json({
      success: true,
      target_km: rounded,
      category: newCategory
    });
  } catch (err) {
    console.error('Error updating target:', err);
    return res.status(500).json({ error: 'Gagal memperbarui target: ' + err.message });
  }
});

// ---------------- RUN SESSIONS API ----------------

// Get all sessions of current user
app.get('/api/sessions', requireAuth, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, run_date, distance_km, duration_sec, notes, created_at
      FROM run_sessions
      WHERE user_id = ?
      ORDER BY run_date ASC, id ASC
    `).all(req.user.id);

    return res.json({
      sessions
    });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    return res.status(500).json({ error: 'Gagal mengambil data sesi lari: ' + err.message });
  }
});

// Add new run session
app.post('/api/sessions', requireAuth, (req, res) => {
  try {
    const { run_date, distance_km, duration_min, duration_sec } = req.body;

    if (!run_date) {
      return res.status(400).json({ error: 'Tanggal lari wajib diisi.' });
    }

    const dist = parseFloat(distance_km);
    if (isNaN(dist) || dist <= 0) {
      return res.status(400).json({ error: 'Jarak lari harus lebih dari 0 KM.' });
    }

    const mins = parseInt(duration_min, 10) || 0;
    const secs = parseInt(duration_sec, 10) || 0;
    const totalDurationSec = (mins * 60) + secs;

    if (totalDurationSec <= 0) {
      return res.status(400).json({ error: 'Durasi lari harus valid dan lebih dari 0 detik.' });
    }

    const insert = db.prepare(`
      INSERT INTO run_sessions (user_id, run_date, distance_km, duration_sec)
      VALUES (?, ?, ?, ?)
    `);

    const result = insert.run(req.user.id, run_date, parseFloat(dist.toFixed(2)), totalDurationSec);

    return res.json({
      success: true,
      message: 'Sesi lari berhasil dicatat ke database!',
      session: {
        id: Number(result.lastInsertRowid),
        user_id: req.user.id,
        run_date,
        distance_km: parseFloat(dist.toFixed(2)),
        duration_sec: totalDurationSec
      }
    });
  } catch (err) {
    console.error('Error adding session:', err);
    return res.status(500).json({ error: 'Gagal menyimpan sesi: ' + err.message });
  }
});

// Delete a run session
app.delete('/api/sessions/:id', requireAuth, (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const result = db.prepare('DELETE FROM run_sessions WHERE id = ? AND user_id = ?').run(sessionId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    return res.json({
      success: true,
      message: 'Sesi lari berhasil dihapus.'
    });
  } catch (err) {
    console.error('Error deleting session:', err);
    return res.status(500).json({ error: 'Gagal menghapus sesi: ' + err.message });
  }
});

// ---------------- LEADERBOARD API ----------------

// Get challenge leaderboard across all runners
app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.bib_number, 
        u.target_km,
        COUNT(s.id) as total_sessions,
        COALESCE(SUM(s.distance_km), 0) as total_km,
        COALESCE(SUM(s.duration_sec), 0) as total_duration_sec
      FROM users u
      LEFT JOIN run_sessions s ON u.id = s.user_id
      GROUP BY u.id
      ORDER BY total_km DESC, total_sessions DESC
    `).all();

    const leaderboard = rows.map((r, index) => {
      const totalKm = parseFloat((r.total_km || 0).toFixed(2));
      const targetKm = parseFloat((r.target_km || 10).toFixed(2));
      const percent = targetKm > 0 ? Math.min(100, (totalKm / targetKm) * 100) : 0;
      
      let avgPace = '-';
      if (totalKm > 0 && r.total_duration_sec > 0) {
        const secPerKm = r.total_duration_sec / totalKm;
        const mins = Math.floor(secPerKm / 60);
        const secs = Math.round(secPerKm % 60);
        avgPace = `${mins}'${String(secs).padStart(2, '0')}"`;
      }

      return {
        rank: index + 1,
        id: r.id,
        name: r.name,
        bib_number: r.bib_number,
        target_km: targetKm,
        total_km: totalKm,
        total_sessions: r.total_sessions,
        percent: parseFloat(percent.toFixed(1)),
        is_finisher: totalKm >= targetKm,
        avg_pace: avgPace
      };
    });

    return res.json({ leaderboard });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Gagal mengambil data peringkat: ' + err.message });
  }
});

// SPA / Page routing
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Fallback routing for SPA / Pages
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Stride Run Tracker Server berjalan di:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`=================================================`);
});
