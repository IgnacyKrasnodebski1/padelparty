import type { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * Błąd z jawnym statusem HTTP. Kontrakt (contracts/api.md): każdy błąd to
 * `{ "error": string }` + status. Kody istotne kontraktowo: 409 SLOT_TAKEN,
 * 410 BOOKING_EXPIRED, 402 PAYMENT_REQUIRED, 423 CARD_ALREADY_ACTIVE,
 * 404 CARD_UNKNOWN, 403 CLUB_NOT_ACTIVE, 401 MFA_REQUIRED.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Nieznane `/api/*` — legacy (server.js) odpowiadał dokładnie tak. */
export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Mutacje legacy sygnalizują błąd walidacji zwykłym Error — server.js mapował
  // to na 400 z treścią wyjątku. Odwzorowane w module legacy, tutaj zostaje
  // tylko sieć bezpieczeństwa identyczna z legacy: 500 + log.
  console.error(err);
  res.status(500).json({ error: 'server error' });
};
