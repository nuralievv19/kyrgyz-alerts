require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: '✅ KYRGYZ ALERTS Server работает!' });
});

// Донат endpoint
app.post('/api/donations', async (req, res) => {
  const { streamerId, donorName, amount, message } = req.body;

  if (!streamerId || !donorName || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`💸 Новый донат: ${donorName} → ${amount}сом → стример ${streamerId}`);

  res.json({
    success: true,
    message: 'Донат получен!',
    data: { streamerId, donorName, amount, message }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
