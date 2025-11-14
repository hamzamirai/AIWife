// Express server for traditional hosting
// Alternative to serverless functions for those who prefer a backend server

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API key endpoint
// WARNING: This still exposes the API key to the client
// For true security, implement WebSocket proxying
app.post('/api/session', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { action } = req.body;

  if (action === 'getApiKey') {
    // In production, implement proper authentication here
    return res.json({ apiKey });
  }

  res.status(400).json({ error: 'Invalid action' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
