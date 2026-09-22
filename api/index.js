/**
 * Wejście dla Vercela. Celowo zwykły JS importujący SKOMPILOWANY backend:
 * gdyby to był TypeScript, builder Vercela typowałby go z poziomu korzenia
 * repo, gdzie nie ma klienta Prismy — i wywalał się na brakujących typach.
 * Kompilacją zajmuje się `npm run build` (tsc w backend/).
 *
 * Cały ruch (/api/*, /healthz, statyki PWA) idzie przez tę jedną funkcję,
 * dokładnie jak dziś w server.js.
 */
const { app } = require('../backend/dist/app.js');

module.exports = app;
