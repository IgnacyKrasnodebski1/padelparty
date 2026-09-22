import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { errorHandler } from './middleware/errors';
import { managerRouter } from './modules/auth/manager';
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

// Kolejność ma znaczenie: legacyRouter kończy się catch-allem na /api/*,
// więc trasy menedżera muszą być zamontowane przed nim.
app.use(managerRouter);
app.use(legacyRouter);

/**
 * PWA graczy (index.html, sw.js, manifest, ikony, privacy.html) leży w korzeniu
 * repo i woła API jako same-origin (`API=''` w index.html). Dziś serwuje ją
 * `serveStatic` w server.js — bez tego bloku przełączenie ruchu na nowy backend
 * wyłożyłoby stronę.
 *
 * Katalog wykrywamy po obecności index.html, bo __dirname wypada gdzie indziej
 * w każdym z trzech środowisk: `src/` pod tsx, `dist/` po kompilacji i bundle
 * funkcji na Vercelu (tam pasuje dopiero cwd).
 */
const webRootCandidates = [
  path.resolve(__dirname, '..', '..'),
  path.resolve(__dirname, '..'),
  process.cwd(),
];
const webRoot =
  webRootCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ??
  webRootCandidates[0]!;

app.use(express.static(webRoot, { index: 'index.html' }));

// Musi być ostatni — Express rozpoznaje middleware błędu po czterech argumentach.
app.use(errorHandler);
