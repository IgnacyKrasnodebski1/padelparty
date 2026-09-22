/**
 * Wejście dla Vercela. Celowo zwykły JS importujący SKOMPILOWANY backend:
 * gdyby to był TypeScript, builder typowałby go z poziomu korzenia repo, gdzie
 * nie ma wygenerowanego klienta Prismy, i wywalał się na brakujących typach.
 *
 * Cały ruch (/api/*, /healthz, statyki PWA) idzie przez tę jedną funkcję,
 * dokładnie jak dziś w server.js.
 *
 * UWAGA na zależności ESM-only: runtime Vercela ładuje moduły własnym loaderem,
 * który NIE robi interopu ESM w bundlu CommonJS (stąd zejście z otplib 13 na 12).
 * Jeśli kiedyś funkcja zacznie zwracać 500 od pierwszego żądania, najpierw
 * sprawdź w logach, czy nie leci ERR_REQUIRE_ESM z któregoś pakietu.
 */
let app;
let bootError = null;

try {
  app = require('../backend/dist/app.js').app;
} catch (err) {
  // Bez tego błąd startu funkcji daje nieczytelne FUNCTION_INVOCATION_FAILED
  // bez śladu w logach.
  bootError = err;
  console.error('Backend nie wstał:', err);
}

module.exports = (req, res) => {
  if (bootError) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'server error' }));
    return;
  }
  return app(req, res);
};
