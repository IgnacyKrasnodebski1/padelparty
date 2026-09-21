import path from 'node:path';
import express from 'express';
import { errorHandler } from './middleware/errors';
import { healthz } from './modules/health';
import { legacyRouter } from './modules/legacy/routes';

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

// Legacy obsługiwał /healthz dla KAŻDEJ metody (server.js), nie tylko GET.
app.all('/healthz', healthz);

app.use(legacyRouter);

/**
 * PWA graczy (index.html, sw.js, manifest, ikony, privacy.html) leży w korzeniu
 * repo i woła API jako same-origin (`API=''` w index.html). Dziś serwuje ją
 * `serveStatic` w server.js — bez tego bloku przełączenie ruchu na nowy backend
 * (T018) wyłożyłoby stronę. Ścieżka wychodzi na korzeń repo zarówno z `src/`
 * (tsx dev), jak i ze skompilowanego `dist/`.
 */
app.use(express.static(path.resolve(__dirname, '..', '..'), { index: 'index.html' }));

// Musi być ostatni — Express rozpoznaje middleware błędu po czterech argumentach.
app.use(errorHandler);
