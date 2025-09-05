// SQLite ile taşınmaz verilerini saklamak için temel veritabanı kodu
// Kodlar açıklamalı ve yeni başlayanlar için uygundur

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tasinmazlar.db');

// Veritabanı ve tablo oluşturma
// Uygulama ilk çalıştığında tablo yoksa oluşturulur
const tabloOlustur = () => {
  db.run(`CREATE TABLE IF NOT EXISTS tasinmazlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT,
    konum TEXT,
    tur TEXT,
    deger INTEGER,
    kullanim TEXT,
    enerji_tuketim INTEGER,
    enerji_birim TEXT
  )`);
  // ensure photos column (JSON array) exists
  db.get("PRAGMA table_info('tasinmazlar')", (err, info) => {
    // quick check for column
    db.all("PRAGMA table_info('tasinmazlar')", (e, cols) => {
      if (!e) {
        const names = (cols||[]).map(c => c.name);
        if (!names.includes('photos')) {
          db.run('ALTER TABLE tasinmazlar ADD COLUMN photos TEXT');
        }
      }
    });
  });
  // users tablosu (basit auth için)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user'
  )`);
};

tabloOlustur();

module.exports = db;
