
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'kyrgyz-alerts-secret-2026';

// Firebase
const serviceAccount = {
  type: "service_account",
  project_id: "kyrgyz-alerts",
  private_key_id: "479161cf4e215988219f4bcc8d46ab4454255fa0",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPRHHlFITdInoB\n8nYoU11ErDgZbNDRPw+qYFAZMbG8AgeytPVpfg/F+BV839BtOG8O2TW3qJIj1hqN\nY7giw9m/7HKq/cwIREsVC7jaREUC4NRuaix+GhhynMKPi7Cm2nSx+9Drd833qvuo\nsEpyniqD3IILL7KbFhOrVdewe1WjRhFtqhFS4K2MBmKdRsplwIpoZKMjCoYKKGEV\nGCszHMJUf3zVub7DA1wnCrkUtlDUgxaVqk5Q30DZdR7iEVVLOm4mGl8Ih6WnCQct\nVJScO8j0XaoEha+Kn2D4uwn8OPfww2tKz9KGyhxsleT5pvADkl5/930R4B9XwxfX\nwRX9UecHAgMBAAECggEAIVAxdC3jmv1PGeAEEMAxZfe+PovoVjFqDarURPBhTkQP\nQ7BlH3MFCv8wSPVaNSvUYdEUmrPL5Vmkw+PqtR/AcGILHiOTtyJu5O+Q4vgFFYzY\nZ/TFuPDtzAIZHWRI3NCQ4AiG0Endv3hqYXcQSDLWx4HaHv0oGlgmiivOco2oOoke\nst2FQZ1T5ygLcnmCPJEA90pugujW5QewGcsqQaJwKGk7RMaH4jkjhXr4hm/WbGJq\nd9TCHOvqUPiRRbPoPDgp7/HKBEbx2yRgoM9SxbjCgrv5seqAgZT89ee2Epy6Qk1w\nFrfrFHV9RhMqpD61j8FMxyYS2RTp+0oPwj1BzAti7QKBgQD7Bgt3f1z62greQc4g\nHMuPUasCdAUW77bsLRFdFGhPLtHNK/KOqdzw5DWN74hOZXIRcod6+s30ZZnvRT7X\nBIBnuXxfze119fpqdGqNSjDE48dLUqrbapvxgKPxLwIRv9yrAXkLGFusah67Op8c\nGdaCZQptL30EsUGvBoUQJYoLCwKBgQDTYFXYfUJ0gNFljWElgGADI2ClQa8NYefG\nT6NB1VceGd6kG1QYXzddW0tU43qRk1feO8+G5cj9fliPtr/nFOg42eqQ2nV8IsqX\nr9zBxnGFo3pAqIqzwDi+chVGUGWgKPYmZLqPxHOe46yshmhBm3rustNyQsGFdX8i\nyriEI/FxdQKBgAbBruVUhEgsPkalNssee0wsQpIaVVi8swvAWstKlVQsSnFfUXQN\nlmjVe6uKWvzhNiTKFGN3BLwjT/Vkw8A92sbv8y0Q+edG66qZ35RV/uINz3tzii3F\nvNTPRZpkTYX0yBfCPmPSEAWgBZu8hDPZbjCsT4+Iy7CopL/1SPeaSxDpAoGBAJvv\nyeT4I3qHPfNJJY3g8vPduYKwvk+FFtO6FJqQpMBUHWe7sYJ5XALHQv/RAa87n+sW\n/LZr9qbr+rGrBE+ZoOev+9f5EgsOL59P4fAiUcVhIONqc0jAWhxFVWSWEyLglRcl\n4GwHZbSmCdENJwSfi0VlL5Bvpwyp7azhGNaDHa+xAoGBAIBiP2VlhOxyxHgB5kyj\nr40qFQejRePhePnqMj24LYWwS9W5CpMK0ZXuyJVhQoy8Jzv1KWTxGxBMS6O7aLV9\nkw7MHoLUyj7NNIcq0EtdVMvJHzy5WvEmE4G5bRLLS7JO3c/unfLi3++03R9DPaWW\nt5Ly7Ij5jU6NPya1u5oodMZo\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@kyrgyz-alerts.iam.gserviceaccount.com",
  client_id: "102090496792292174213",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token"
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS streamers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100),
        username VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        password_hash TEXT,
        fcm_token TEXT,
        mbank_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        streamer_id INTEGER REFERENCES streamers(id),
        donor_name VARCHAR(100) NOT NULL,
        amount DECIMAL NOT NULL,
        currency VARCHAR(10) DEFAULT 'KGS',
        message TEXT,
        source VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Таблицы готовы');
  } catch(e) {
    console.error('❌ DB error:', e.message);
  }
}

// ── Express + HTTP сервер ──
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ── WebSocket сервер ──
const wss = new WebSocketServer({ server });

// Хранилище подключений: streamerId → Set<WebSocket>
const streamerConnections = new Map();

wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket подключён');
  let streamerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // OBS виджет представляется: { type: 'subscribe', streamerId: 1, token: '...' }
      if (msg.type === 'subscribe') {
        streamerId = msg.streamerId;
        if (!streamerConnections.has(streamerId)) {
          streamerConnections.set(streamerId, new Set());
        }
        streamerConnections.get(streamerId).add(ws);
        console.log(`📺 OBS виджет подписался на стримера ID:${streamerId}`);
        ws.send(JSON.stringify({ type: 'connected', message: 'Подписка активна!' }));
      }
    } catch(e) {
      console.error('WS parse error:', e.message);
    }
  });

  ws.on('close', () => {
    if (streamerId && streamerConnections.has(streamerId)) {
      streamerConnections.get(streamerId).delete(ws);
      console.log(`📺 OBS виджет отключился от стримера ID:${streamerId}`);
    }
  });

  ws.on('error', (err) => console.error('WS error:', err.message));
});

// Отправить алерт всем OBS виджетам стримера
function sendAlertToOBS(streamerId, donationData) {
  const connections = streamerConnections.get(streamerId);
  if (!connections || connections.size === 0) {
    console.log(`⚠️ Нет активных OBS виджетов для стримера ID:${streamerId}`);
    return 0;
  }

  const payload = JSON.stringify({
    type: 'donation',
    donorName: donationData.donorName,
    amount: donationData.amount,
    currency: donationData.currency || 'KGS',
    message: donationData.message || '',
    source: donationData.source || 'manual',
    timestamp: new Date().toISOString()
  });

  let sent = 0;
  connections.forEach(ws => {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
      sent++;
    }
  });

  console.log(`📡 Алерт отправлен в ${sent} OBS виджет(ов)`);
  return sent;
}

// ── MIDDLEWARE: проверка токена ──
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

// ── ROUTES ──

app.get('/', (req, res) => {
  res.json({
    status: '✅ KYRGYZ ALERTS Server работает!',
    websocket: 'wss://kyrgyz-alerts-production.up.railway.app',
    connections: wss.clients.size
  });
});

// РЕГИСТРАЦИЯ
app.post('/api/auth/register', async (req, res) => {
  const { fullName, username, phone, password } = req.body;
  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'Заполни все поля' });
  }
  try {
    const exists = await pool.query(
      `SELECT id FROM streamers WHERE username = $1 OR phone = $2`,
      [username.toLowerCase(), phone]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Никнейм или телефон уже занят' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO streamers (full_name, username, phone, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, username, full_name`,
      [fullName || username, username.toLowerCase(), phone, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ Новый стример: ${user.username}`);
    res.json({ success: true, token, user: { id: user.id, username: user.username, fullName: user.full_name } });
  } catch(e) {
    console.error('❌ Register error:', e.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ВХОД
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'Введи телефон и пароль' });
  }
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, password_hash FROM streamers WHERE phone = $1`,
      [phone]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный телефон или пароль' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный телефон или пароль' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`✅ Вход: ${user.username}`);
    res.json({ success: true, token, user: { id: user.id, username: user.username, fullName: user.full_name } });
  } catch(e) {
    console.error('❌ Login error:', e.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ⭐ ГЛАВНЫЙ ЭНДПОИНТ — получить донат от Android и отправить в OBS
app.post('/api/donations/notify', async (req, res) => {
  const { streamerId, donorName, amount, currency, message, source, rawText } = req.body;

  if (!streamerId || !donorName || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Сохранить в БД
    const result = await pool.query(
      `INSERT INTO donations (streamer_id, donor_name, amount, currency, message, source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [streamerId, donorName, amount, currency || 'KGS', message || null, source || 'android']
    );
    const donationId = result.rows[0].id;
    console.log(`💸 Донат #${donationId}: ${donorName} → ${amount} ${currency || 'KGS'} (${source})`);

    // 2. Отправить в OBS через WebSocket
    const obsCount = sendAlertToOBS(parseInt(streamerId), {
      donorName, amount, currency, message, source
    });

    // 3. Firebase push (если есть токен)
    const streamer = await pool.query(`SELECT fcm_token FROM streamers WHERE id = $1`, [streamerId]);
    let pushSent = false;
    if (streamer.rows[0]?.fcm_token) {
      try {
        await admin.messaging().send({
          token: streamer.rows[0].fcm_token,
          notification: {
            title: '🎉 Новый донат!',
            body: `${donorName} отправил ${amount} ${currency || 'KGS'}!`,
          },
          android: { priority: 'high' },
        });
        pushSent = true;
      } catch(e) {
        console.log('Push error:', e.message);
      }
    }

    res.json({
      success: true,
      donationId,
      obsAlerts: obsCount,
      pushSent
    });

  } catch(e) {
    console.error('❌', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Получить донаты стримера
app.get('/api/donations/:streamerId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donations WHERE streamer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.streamerId]
    );
    res.json({ success: true, donations: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Публичный профиль стримера
app.get('/api/streamers/:username', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, full_name, mbank_phone FROM streamers WHERE username = $1`,
      [req.params.username.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Стример не найден' });
    res.json({ success: true, streamer: result.rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Запуск ──
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Сервер + WebSocket запущен на порту ${PORT}`);
  console.log(`📡 WebSocket: wss://kyrgyz-alerts-production.up.railway.app`);
});
