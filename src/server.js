const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Pool } = require('pg');

// Firebase — ключ напрямую в коде
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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
        username VARCHAR(100) UNIQUE NOT NULL,
        fcm_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        streamer_id INTEGER,
        donor_name VARCHAR(100) NOT NULL,
        amount INTEGER NOT NULL,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Таблицы готовы');
  } catch (e) {
    console.error('❌ DB error:', e.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: '✅ KYRGYZ ALERTS Server работает!' });
});

// Зарегистрировать стримера
app.post('/api/streamers', async (req, res) => {
  const { username, fcmToken } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO streamers (username, fcm_token)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET fcm_token = $2
       RETURNING id, username`,
      [username, fcmToken || null]
    );
    res.json({ success: true, streamer: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Принять донат и отправить push
app.post('/api/donations', async (req, res) => {
  const { streamerId, donorName, amount, message } = req.body;
  if (!streamerId || !donorName || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO donations (streamer_id, donor_name, amount, message)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [streamerId, donorName, amount, message || null]
    );
    const donationId = result.rows[0].id;
    console.log(`💸 Донат #${donationId}: ${donorName} → ${amount}с`);

    // Push уведомление
    const streamer = await pool.query(
      `SELECT fcm_token FROM streamers WHERE id = $1`, [streamerId]
    );
    let pushSent = false;
    if (streamer.rows[0]?.fcm_token) {
      await admin.messaging().send({
        token: streamer.rows[0].fcm_token,
        notification: {
          title: '🎉 KYRGYZ ALERTS',
          body: `${donorName} отправил ${amount} сом!`,
        },
        data: {
          donorName,
          amount: amount.toString(),
          message: message || '',
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      pushSent = true;
      console.log(`🔔 Push отправлен!`);
    }

    res.json({ success: true, donationId, pushSent });
  } catch (e) {
    console.error('❌', e.message);
    res.status(500).json({ error: e.message });
  }
});

// История донатов
app.get('/api/donations/:streamerId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donations WHERE streamer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.streamerId]
    );
    res.json({ success: true, donations: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
