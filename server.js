const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const os = require('os');
const { spawn } = require('child_process');

let currentPublicUrl = '';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'certificates.json');
const ARTWORKS_FILE = path.join(__dirname, 'data', 'artworks.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer storage for uploaded artworks and logos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Helper: Read certificates
function getCertificates() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading certificates:', err);
    return [];
  }
}

// Helper: Save certificates
function saveCertificates(certs) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(certs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving certificates:', err);
  }
}

// Helper: Read artworks / folders
function getArtworks() {
  try {
    if (!fs.existsSync(ARTWORKS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(ARTWORKS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading artworks:', err);
    return [];
  }
}

// Helper: Save artworks / folders
function saveArtworks(artworks) {
  try {
    const dir = path.dirname(ARTWORKS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ARTWORKS_FILE, JSON.stringify(artworks, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving artworks:', err);
  }
}

// Helper: Get primary local IPv4
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Helper: Get public URL
function getPublicTunnelUrl() {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  return 'https://phamngoc.onrender.com';
}

// API: System info (for QR scanning directly to phone on LAN or Internet)
app.get('/api/info', (req, res) => {
  const localIp = getLocalIp();
  const host = req.get('host') || `${localIp}:${PORT}`;
  const protocol = req.protocol || 'http';
  const publicTunnel = getPublicTunnelUrl();
  res.json({
    localIp,
    port: PORT,
    baseUrl: publicTunnel || `${protocol}://${host}`,
    lanUrl: `http://${localIp}:${PORT}`,
    publicUrl: publicTunnel
  });
});

// API: Get all artwork folders / collections
app.get('/api/artworks', (req, res) => {
  const artworks = getArtworks();
  const certs = getCertificates();
  let changed = false;

  // Auto-sync any artwork titles from existing certificates
  certs.forEach(c => {
    if (c.title && !artworks.some(a => a.title.trim().toLowerCase() === c.title.trim().toLowerCase())) {
      const title = c.title.trim();
      artworks.push({
        id: removeVietnameseTones(title).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: title,
        abbr: getTitleAbbreviation(title),
        totalLimit: parseInt((c.edition || '').split('/')[1] || '50', 10) || 50,
        size: c.size || '50 x 70 cm',
        releaseYear: c.releaseYear || '2026',
        author: c.author || 'Phạm Ngọc\n(Kột Nhà Decor)',
        image: c.image || '/assets/sample-artwork.jpg',
        createdAt: c.createdAt || new Date().toISOString()
      });
      changed = true;
    }
  });

  if (changed) {
    saveArtworks(artworks);
  }

  res.json(artworks);
});

// API: Create a new artwork folder / collection
app.post('/api/artworks', upload.fields([
  { name: 'artworkImage', maxCount: 1 }
]), (req, res) => {
  try {
    const artworks = getArtworks();
    const body = req.body;
    const title = (body.title || '').trim();

    if (!title) {
      return res.status(400).json({ error: 'Tên tác phẩm không được để trống' });
    }

    if (artworks.some(a => a.title.trim().toLowerCase() === title.toLowerCase())) {
      return res.status(400).json({ error: `Thư mục tranh "${title}" đã tồn tại!` });
    }

    let artworkImagePath = body.existingImage || '/assets/sample-artwork.jpg';
    if (req.files && req.files['artworkImage'] && req.files['artworkImage'][0]) {
      artworkImagePath = '/uploads/' + req.files['artworkImage'][0].filename;
    }

    const newArtwork = {
      id: removeVietnameseTones(title).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: title,
      abbr: getTitleAbbreviation(title),
      totalLimit: parseInt(body.totalLimit, 10) || 50,
      size: (body.size || '50 x 70 cm').trim(),
      releaseYear: (body.releaseYear || new Date().getFullYear()).toString().trim(),
      author: (body.author || 'Phạm Ngọc\n(Kột Nhà Decor)').trim(),
      image: artworkImagePath,
      createdAt: new Date().toISOString()
    };

    artworks.unshift(newArtwork);
    saveArtworks(artworks);
    res.status(201).json(newArtwork);
  } catch (err) {
    console.error('Error creating artwork folder:', err);
    res.status(500).json({ error: 'Lỗi tạo thư mục: ' + err.message });
  }
});

// API: Delete an artwork folder
app.delete('/api/artworks/:id', (req, res) => {
  try {
    let artworks = getArtworks();
    const id = req.params.id;
    const initialLen = artworks.length;
    artworks = artworks.filter(a => a.id !== id && a.title.toLowerCase() !== id.toLowerCase());
    if (artworks.length === initialLen) {
      return res.status(404).json({ error: 'Không tìm thấy thư mục' });
    }
    saveArtworks(artworks);
    res.json({ success: true, message: 'Đã xóa thư mục tranh' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa thư mục: ' + err.message });
  }
});

// API: Get all certificates
app.get('/api/certificates', (req, res) => {
  const certs = getCertificates();
  res.json(certs);
});

// API: Get single certificate by ID or certCode
app.get('/api/certificates/:id', (req, res) => {
  const certs = getCertificates();
  const cert = certs.find(c => c.id === req.params.id || c.certCode === req.params.id || (c.altCode && c.altCode === req.params.id));
  if (!cert) {
    return res.status(404).json({ error: 'Không tìm thấy chứng nhận' });
  }
  res.json(cert);
});

// API: Create new certificate
app.post('/api/certificates', upload.fields([
  { name: 'artworkImage', maxCount: 1 },
  { name: 'brandLogo', maxCount: 1 }
]), async (req, res) => {
  try {
    const certs = getCertificates();
    const body = req.body;
    
    const certCode = (body.certCode || '').trim() || `KND-${Date.now().toString().slice(-6)}`;
    const id = certCode;

    // Check duplicate
    if (certs.some(c => c.id === id || c.certCode === certCode)) {
      return res.status(400).json({ error: `Mã chứng nhận "${certCode}" đã tồn tại. Vui lòng chọn mã khác.` });
    }

    let artworkImagePath = body.existingImage || '/assets/sample-artwork.jpg';
    if (req.files && req.files['artworkImage'] && req.files['artworkImage'][0]) {
      artworkImagePath = '/uploads/' + req.files['artworkImage'][0].filename;
    }

    let brandLogoPath = body.existingLogo || '/assets/sample-logo.png';
    if (req.files && req.files['brandLogo'] && req.files['brandLogo'][0]) {
      brandLogoPath = '/uploads/' + req.files['brandLogo'][0].filename;
    }

    const newCert = {
      id: id,
      title: body.title || 'Long Tranh Hổ Đấu',
      verificationStatus: body.verificationStatus || 'verified',
      verificationStatusText: body.verificationStatusText || 'ĐÃ XÁC THỰC',
      edition: body.edition || '01 / 50',
      certCode: certCode,
      size: body.size || '50 x 70 cm',
      material: body.material || 'In canvas cao cấp',
      releaseYear: body.releaseYear || new Date().getFullYear().toString(),
      author: body.author || 'Phạm Ngọc\n(Kột Nhà Decor)',
      status: body.status || 'Đã bán',
      owner: body.owner || 'Nguyễn Văn A',
      verificationDate: body.verificationDate || new Date().toLocaleDateString('vi-VN'),
      image: artworkImagePath,
      logo: brandLogoPath,
      brandName: body.brandName || 'KỘT NHÀ DECOR',
      note: body.note || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    certs.unshift(newCert);
    saveCertificates(certs);

    res.status(201).json(newCert);
  } catch (err) {
    console.error('Error creating certificate:', err);
    res.status(500).json({ error: 'Lỗi khi lưu chứng nhận: ' + err.message });
  }
});

// API: Update certificate
app.put('/api/certificates/:id', upload.fields([
  { name: 'artworkImage', maxCount: 1 },
  { name: 'brandLogo', maxCount: 1 }
]), async (req, res) => {
  try {
    const certs = getCertificates();
    const index = certs.findIndex(c => c.id === req.params.id || c.certCode === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Không tìm thấy chứng nhận cần sửa' });
    }

    const currentCert = certs[index];
    const body = req.body;

    let artworkImagePath = currentCert.image;
    if (req.files && req.files['artworkImage'] && req.files['artworkImage'][0]) {
      artworkImagePath = '/uploads/' + req.files['artworkImage'][0].filename;
    } else if (body.existingImage) {
      artworkImagePath = body.existingImage;
    }

    let brandLogoPath = currentCert.logo;
    if (req.files && req.files['brandLogo'] && req.files['brandLogo'][0]) {
      brandLogoPath = '/uploads/' + req.files['brandLogo'][0].filename;
    } else if (body.existingLogo) {
      brandLogoPath = body.existingLogo;
    }

    const updatedCert = {
      ...currentCert,
      title: body.title !== undefined ? body.title : currentCert.title,
      verificationStatus: body.verificationStatus || currentCert.verificationStatus,
      verificationStatusText: body.verificationStatusText || currentCert.verificationStatusText,
      edition: body.edition !== undefined ? body.edition : currentCert.edition,
      certCode: body.certCode !== undefined ? body.certCode : currentCert.certCode,
      size: body.size !== undefined ? body.size : currentCert.size,
      material: body.material !== undefined ? body.material : currentCert.material,
      releaseYear: body.releaseYear !== undefined ? body.releaseYear : currentCert.releaseYear,
      author: body.author !== undefined ? body.author : currentCert.author,
      status: body.status !== undefined ? body.status : currentCert.status,
      owner: body.owner !== undefined ? body.owner : currentCert.owner,
      verificationDate: body.verificationDate !== undefined ? body.verificationDate : currentCert.verificationDate,
      image: artworkImagePath,
      logo: brandLogoPath,
      brandName: body.brandName || currentCert.brandName,
      note: body.note !== undefined ? body.note : currentCert.note,
      updatedAt: new Date().toISOString()
    };

    certs[index] = updatedCert;
    saveCertificates(certs);

    res.json(updatedCert);
  } catch (err) {
    console.error('Error updating certificate:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật chứng nhận: ' + err.message });
  }
});

// API: Delete certificate
app.delete('/api/certificates/:id', (req, res) => {
  let certs = getCertificates();
  const initialLen = certs.length;
  certs = certs.filter(c => c.id !== req.params.id && c.certCode !== req.params.id);
  if (certs.length === initialLen) {
    return res.status(404).json({ error: 'Không tìm thấy chứng nhận' });
  }
  saveCertificates(certs);
  res.json({ success: true, message: 'Đã xóa chứng nhận' });
});

// Remove Vietnamese accents / diacritics
function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, (m) => m === 'Đ' ? 'D' : 'd');
  return str;
}

// Generate acronym from artwork title (e.g. "Long Tranh Hổ Đấu" -> "LTHD")
function getTitleAbbreviation(title) {
  if (!title) return 'TRANH';
  const clean = removeVietnameseTones(title).replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'TRANH';
  const abbr = words.map(w => w[0].toUpperCase()).join('');
  return abbr || 'TRANH';
}

// API: Quick update owner name for a certificate
app.patch('/api/certificates/:id/owner', (req, res) => {
  try {
    const certs = getCertificates();
    const cert = certs.find(c => c.id === req.params.id || c.certCode === req.params.id || (c.altCode && c.altCode === req.params.id));
    if (!cert) {
      return res.status(404).json({ error: 'Không tìm thấy chứng nhận' });
    }
    cert.owner = (req.body.owner || '').trim();
    cert.updatedAt = new Date().toISOString();
    saveCertificates(certs);
    res.json({ success: true, message: 'Đã cập nhật tên khách hàng', cert });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật tên khách: ' + err.message });
  }
});

// API: Generate QR Code for a certificate
app.get('/api/qr/:id', async (req, res) => {
  try {
    const certs = getCertificates();
    const cert = certs.find(c => c.id === req.params.id || c.certCode === req.params.id || (c.altCode && c.altCode === req.params.id));
    if (!cert) {
      return res.status(404).json({ error: 'Không tìm thấy chứng nhận' });
    }

    // Determine target URL for scanning
    const customBase = req.query.baseUrl;
    const publicTunnel = getPublicTunnelUrl();
    let targetUrl;
    if (customBase && !customBase.includes('192.168.') && !customBase.includes('localhost')) {
      targetUrl = `${customBase.replace(/\/$/, '')}/verify/${encodeURIComponent(cert.certCode || cert.id)}`;
    } else if (publicTunnel) {
      targetUrl = `${publicTunnel.replace(/\/$/, '')}/verify/${encodeURIComponent(cert.certCode || cert.id)}`;
    } else {
      const localIp = getLocalIp();
      const host = req.get('host') || `${localIp}:${PORT}`;
      const protocol = req.protocol || 'http';
      const scanHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? `${localIp}:${PORT}`
        : host;
      targetUrl = `${protocol}://${scanHost}/verify/${encodeURIComponent(cert.certCode || cert.id)}`;
    }

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    });

    if (req.query.format === 'json') {
      return res.json({ targetUrl, qrDataUrl });
    }

    const img = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    res.end(img);
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).json({ error: 'Lỗi tạo mã QR' });
  }
});

// Verification page route
app.get('/verify/:id', (req, res) => {
  res.sendFile('verify.html', { root: path.join(__dirname, 'public') });
});

// Admin / Editor page fallback route
app.use((req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

function startCloudflareTunnel() {
  const exePath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(exePath)) {
    console.log('⚠️ cloudflared.exe không tìm thấy trong thư mục, bỏ qua tunnel tự động.');
    return;
  }

  console.log('🚀 Đang tự động kích hoạt đường truyền Online 4G/5G (Cloudflare)...');
  const tunnel = spawn(exePath, ['tunnel', '--url', `http://localhost:${PORT}`]);

  tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      currentPublicUrl = match[0];
      const tunnelFile = path.join(__dirname, 'data', 'tunnel.txt');
      fs.writeFileSync(tunnelFile, currentPublicUrl, 'utf8');
      console.log(`\n======================================================`);
      console.log(`🌐 ĐƯỜNG TRUYỀN ONLINE 4G/5G TOÀN CẦU ĐÃ SẴN SÀNG:`);
      console.log(`👉 ${currentPublicUrl}`);
      console.log(`======================================================\n`);
    }
  });

  tunnel.on('close', (code) => {
    console.log(`Cloudflare tunnel đã ngắt (code ${code})`);
  });

  const cleanup = () => {
    try { tunnel.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(); });
  process.on('SIGTERM', () => { cleanup(); process.exit(); });
}

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🎨 KỘT NHÀ DECOR - CÔNG CỤ XÁC THỰC TRANH NGHỆ THUẬT`);
  console.log(`======================================================`);
  console.log(`👉 Mở trên máy tính:       http://localhost:${PORT}`);
  console.log(`📱 Mở trên điện thoại:     http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);

  // Tự động bật đường truyền Online 4G/5G
  startCloudflareTunnel();
});
