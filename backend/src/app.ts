import express from 'express';

export const app = express();

// Stripe webhook wymaga surowego body (podpis) — montowany PRZED json parserem w module payments.
app.use(express.json({ limit: '1mb' }));

// CORS — apka mobilna (Expo web / natywna) i club-web
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'padelparty-backend', storage: 'postgres' });
});
