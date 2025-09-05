// Basit bir Node.js Express API örneği
// Açıklamalar ile yeni başlayanlar için anlaşılır şekilde yazılmıştır

const express = require('express');
const app = express();
const port = 3000;
const db = require('./db'); // SQLite veritabanı bağlantısı
const tahminiDeger = require('./tahmin');
const enerjiRaporu = require('./enerji');
const fiyatOnerisi = require('./fiyat');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ensure uploads dir
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) { const name = Date.now() + '-' + file.originalname.replace(/[^a-z0-9.\-\_\.]/gi,'_'); cb(null, name); }
});
const upload = multer({ storage });

// Simple SSE broadcaster
let clients = [];
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  req.on('close', () => { clients = clients.filter(c => c.id !== clientId); });
});

function broadcastEvent(data) {
  clients.forEach(c => c.res.write(`data: ${JSON.stringify(data)}\n\n`));
}

// serve uploads statically
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(express.json()); // JSON gövdeyi okumak için

// simple auth config
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ hata: 'Yetkisiz' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ hata: 'Token geçersiz' });
  }
}

// Tüm taşınmazları veritabanından listele
app.get('/tasinmazlar', (req, res) => {
  // Desteklenen query: ?tur=Konut&min=100000&max=500000&q=anahtar
  const { tur, min, max, q } = req.query;
  let sql = 'SELECT * FROM tasinmazlar';
  const params = [];
  const where = [];
  if (tur) {
    where.push('tur = ?');
    params.push(tur);
  }
  if (min) {
    where.push('deger >= ?');
    params.push(Number(min));
  }
  if (max) {
    where.push('deger <= ?');
    params.push(Number(max));
  }
  if (q) {
    where.push('(ad LIKE ? OR konum LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ hata: 'Veritabanı hatası.' });
    } else {
      res.json(rows);
    }
  });
});

// ID ile taşınmaz arama (veritabanından)
app.get('/tasinmazlar/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get('SELECT * FROM tasinmazlar WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ hata: 'Veritabanı hatası.' });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ hata: 'Taşınmaz bulunamadı.' });
    }
  });
});

// Yeni taşınmaz ekleme (veritabanına)
app.post('/tasinmazlar', authMiddleware, (req, res) => {
  const { ad, konum, tur, deger, kullanim, enerji } = req.body;
  db.run(
    'INSERT INTO tasinmazlar (ad, konum, tur, deger, kullanim, enerji_tuketim, enerji_birim) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [ad, konum, tur, deger, kullanim, (enerji && enerji.tuketim) || 0, (enerji && enerji.birim) || 'kWh/ay'],
    function (err) {
      if (err) {
        res.status(500).json({ hata: 'Veritabanı hatası.' });
      } else {
        const created = { id: this.lastID, ad, konum, tur, deger, kullanim, enerji };
        // broadcast via SSE
        broadcastEvent({ type: 'tasinmaz_created', item: created });
        res.status(201).json(created);
      }
    }
  );
});

// register
app.post('/auth/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ hata: 'Eksik alan' });
  const hash = bcrypt.hashSync(password, 8);
  db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role || 'user'], function(err){
    if (err) return res.status(400).json({ hata: 'Kullanıcı oluşturulamadı' });
    const user = { id: this.lastID, username, role: role || 'user' };
    res.json({ token: generateToken(user), user });
  });
});

// login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ hata: 'Eksik alan' });
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) return res.status(400).json({ hata: 'Kullanıcı bulunamadı' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ hata: 'Şifre yanlış' });
    res.json({ token: generateToken(user), user: { id: user.id, username: user.username, role: user.role } });
  });
});

// Fotoğraf yükleme route: form-data, field 'foto'
app.post('/tasinmazlar/:id/foto', authMiddleware, upload.array('foto', 10), (req, res) => {
  const id = Number(req.params.id);
  if (!req.files || req.files.length === 0) return res.status(400).json({ hata: 'Dosya yok.' });
  // fetch existing photos (JSON stored in photos column) and append
  db.get('SELECT photos FROM tasinmazlar WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ hata: 'Kayıt bulunamadı.' });
    let photos = [];
    try { photos = row.photos ? JSON.parse(row.photos) : []; } catch(e){ photos = []; }
    req.files.forEach(f => photos.push(`/uploads/${f.filename}`));
    db.run('UPDATE tasinmazlar SET photos = ? WHERE id = ?', [JSON.stringify(photos), id], function(uerr){
      if (uerr) return res.status(500).json({ hata: 'Güncelleme hatası.' });
      // broadcast update
      broadcastEvent({ type: 'tasinmaz_photos_updated', id, photos });
      res.json({ id, photos });
    });
  });
});

// Taşınmaz değer tahmini endpointi
app.post('/tahmin', (req, res) => {
  const ozellikler = req.body;
  const tahmin = tahminiDeger(ozellikler);
  res.json({ tahmini_deger: tahmin });
});

// Enerji verimliliği ve sürdürülebilirlik raporu endpointi
app.post('/enerji-raporu', (req, res) => {
  const ozellikler = req.body;
  // enerji.js şimdi bir nesne döndürüyor
  const rapor = enerjiRaporu(ozellikler);
  res.json(rapor);
});

// Aylık enerji simülasyonu
app.get('/enerji-simulate', (req, res) => {
  const tur = req.query.tur || 'Konut';
  const seed = Number(req.query.seed) || 1;
  const sim = require('./enerji').simulateEnerji({ seed, tur });
  res.json(sim);
});

// PDF raporu: taşınmaz id'si verilecek, özet PDF döndürülecek
const PDFDocument = require('pdfkit');
app.get('/rapor/pdf/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM tasinmazlar WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ hata: 'Kayıt bulunamadı.' });
    // enerji raporu
    const er = enerjiRaporu({ enerji: { tuketim: row.enerji_tuketim || 0, birim: row.enerji_birim || 'kWh/ay' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=rapor-${id}.pdf`);
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(18).text(`Taşınmaz Raporu - ${row.ad}`, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Konum: ${row.konum}`);
    doc.text(`Tür: ${row.tur}`);
    doc.text(`Değer: ${row.deger} TL`);
    doc.moveDown();
    doc.text('Enerji Raporu:');
    doc.text(`Tüketim: ${er.tuketim} ${er.birim}`);
    doc.text(`Verimlilik: ${er.verimlilik}`);
    doc.text(`Sürdürülebilirlik: ${er.surdurulebilirlik}`);
    doc.moveDown();
    doc.text('Not: Bu rapor otomatik oluşturulmuştur.');
    doc.end();
  });
});

// Dinamik fiyat önerisi endpointi
app.post('/fiyat-onerisi', (req, res) => {
  const ozellikler = req.body;
  const fiyat = fiyatOnerisi(ozellikler);
  res.json({ onerilen_fiyat: fiyat });
});

// Harita görselleştirme için taşınmazların konum ve temel bilgilerini döndüren endpoint
app.get('/harita-veri', (req, res) => {
  db.all('SELECT id, ad, konum, tur, deger FROM tasinmazlar', [], (err, rows) => {
    if (err) {
      res.status(500).json({ hata: 'Veritabanı hatası.' });
    } else {
      // Harita uygulamaları için uygun formatta veri döndürülür
      res.json(rows);
    }
  });
});

// Yasal bilgi ve izin süreçleri için örnek endpoint
app.get('/yasal-bilgi', (req, res) => {
  res.json({
    imar_kanunu: '3194 sayılı İmar Kanunu şehir planlaması ve yapılaşmayı düzenler.',
    tapu_kanunu: '2644 sayılı Tapu Kanunu mülkiyet haklarını korur.',
    belediyeler_kanunu: '5393 sayılı Kanun belediyelerin taşınmaz yönetimi görevlerini belirler.',
    izin_sureci: 'Yapı ruhsatı, imar planı ve tapu işlemleri için ilgili kurumlara başvuru gereklidir.'
  });
});

// Frontend dosyasını sunmak için endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend.html'));
});

app.get('/frontend.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend.html'));
});

app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});
