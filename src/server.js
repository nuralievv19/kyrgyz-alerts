require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Pool } = require('pg');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS streamers (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      fcm_token TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      streamer_id INTEGER REFERENCES streamers(id),
      donor_name VARCHAR(100) NOT NULL,
      amount INTEGER NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Таблицы готовы');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: '✅ KYRGYZ ALERTS Server работает!' });
});

app.post('/api/donations', async (req, res) => {
  const { streamerId, donorName, amount, message } = req.body;
  if (!streamerId || !donorName || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO donations (streamer_id, donor_name, amount, message) VALUES ($1, $2, $3, $4) RETURNING id`,
      [streamerId, donorName, amount, message || null]
    );
    const donationId = result.rows[0].id;
    console.log(`💸 Донат ID:${donationId} | ${donorName} → ${amount}с`);

    const streamer = await pool.query(`SELECT fcm_token FROM streamers WHERE id = $1`, [streamerId]);
    let pushSent = false;
    if (streamer.rows[0]?.fcm_token) {
      await admin.messaging().send({
        token: streamer.rows[0].fcm_token,
        notification: { title: '🎉 KYRGYZ ALERTS', body: `${donorName} отправил ${amount} сом!` },
        data: { donorName, amount: amount.toString(), message: message || '', donationId: donationId.toString() },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      pushSent = true;
      console.log(`🔔 Push отправлен стримеру ID:${streamerId}`);
    }

    res.json({ success: true, donationId, pushSent, message: 'Донат успешно отправлен!' });
  } catch (error) {
    console.error('❌', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/streamers', async (req, res) => {
  const { username, fcmToken } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO streamers (username, fcm_token) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET fcm_token = $2 RETURNING id, username`,
      [username, fcmToken || null]
    );
    res.json({ success: true, streamer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/donations/:streamerId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donations WHERE streamer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.streamerId]
    );
    res.json({ success: true, donations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
