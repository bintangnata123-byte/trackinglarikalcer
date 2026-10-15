const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'tracker.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys for performance and data integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    name TEXT NOT NULL,
    bib_number TEXT NOT NULL,
    target_km REAL DEFAULT 10.0,
    category TEXT DEFAULT '10K OPEN',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS run_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    run_date TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_sec INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON run_sessions(user_id, run_date);
  CREATE INDEX IF NOT EXISTS idx_auth_token ON auth_sessions(token);
`);

// Password hashing helpers
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// Seed initial users if empty
function seedDataIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('Seeding initial runners and data...');

    // 1. Reni Mailinar (as per code.html and screenshot)
    const reniCreds = hashPassword('password123');
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, password_salt, name, bib_number, target_km, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const reniResult = insertUser.run(
      'reni',
      'reni@stride.id',
      reniCreds.hash,
      reniCreds.salt,
      'Reni Mailinar',
      '#BIB-10492',
      10.0,
      '10K OPEN'
    );
    const reniId = Number(reniResult.lastInsertRowid);

    // Initial 3 runs for Reni matching code.html:
    // Sesi 1: 2026-10-11, 1.50 KM, 28:27 (1707 detik) -> Pace 18'58"/km
    // Sesi 2: 2026-10-12, 3.00 KM, 37:21 (2241 detik) -> Pace 12'27"/km
    // Sesi 3: 2026-10-13, 5.09 KM, 46:25 (2785 detik) -> Pace 9'07"/km
    const insertSession = db.prepare(`
      INSERT INTO run_sessions (user_id, run_date, distance_km, duration_sec)
      VALUES (?, ?, ?, ?)
    `);

    insertSession.run(reniId, '2026-10-11', 1.50, Math.round((18 * 60 + 58) * 1.5));
    insertSession.run(reniId, '2026-10-12', 3.00, Math.round((12 * 60 + 27) * 3));
    insertSession.run(reniId, '2026-10-13', 5.09, Math.round((9 * 60 + 7) * 5.09));

    // 2. Dimas Pratama (Runner 2 for leaderboard)
    const dimasCreds = hashPassword('password123');
    const dimasResult = insertUser.run(
      'dimas',
      'dimas@stride.id',
      dimasCreds.hash,
      dimasCreds.salt,
      'Dimas Pratama',
      '#BIB-10518',
      10.0,
      '10K OPEN'
    );
    const dimasId = Number(dimasResult.lastInsertRowid);
    insertSession.run(dimasId, '2026-10-10', 4.20, 28 * 60 + 10);
    insertSession.run(dimasId, '2026-10-12', 3.80, 24 * 60 + 45);

    // 3. Siti Rahma (Runner 3 for leaderboard - Finisher)
    const sitiCreds = hashPassword('password123');
    const sitiResult = insertUser.run(
      'siti',
      'siti@stride.id',
      sitiCreds.hash,
      sitiCreds.salt,
      'Siti Rahmawati',
      '#BIB-10384',
      10.0,
      '10K OPEN'
    );
    const sitiId = Number(sitiResult.lastInsertRowid);
    insertSession.run(sitiId, '2026-10-09', 5.00, 32 * 60 + 15);
    insertSession.run(sitiId, '2026-10-11', 5.00, 31 * 60 + 40);

    console.log('Seeding completed successfully!');
  }
}

seedDataIfEmpty();

module.exports = {
  db,
  hashPassword,
  verifyPassword
};
