import type { RequestHandler } from 'express';
import { ApiError } from './errors';

interface RateLimitOptions {
  /** Długość okna w ms. */
  windowMs: number;
  /** Ile żądań mieści się w oknie. */
  max: number;
  /** Klucz kubełka — domyślnie IP. Dla loginu sensowniejszy bywa IP + login. */
  key?: (ip: string, body: unknown) => string;
  message?: string;
}

/**
 * Sliding window w pamięci procesu. Świadomie bez zewnętrznej paczki: Render
 * trzyma jedną instancję serwisu, więc pamięć procesu w zupełności wystarcza.
 * UWAGA: przy skalowaniu do ≥2 instancji limit przestaje być globalny i trzeba
 * go przenieść do bazy albo do Redisa.
 *
 * Tu jest sam mechanizm — twarde limity na wrażliwe endpointy (login/TOTP/
 * activate: 5/min) montuje T102.
 */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const hits = new Map<string, number[]>();
  const message = opts.message ?? 'Za dużo prób — spróbuj za chwilę';

  return (req, _res, next) => {
    // Testy wykonują dziesiątki żądań pod rząd z jednego adresu. Sam mechanizm
    // ma własny test jednostkowy, który tę flagę zdejmuje.
    if (process.env.RATE_LIMIT_OFF === '1') return next();

    const ip = req.ip ?? 'unknown';
    const key = opts.key ? opts.key(ip, req.body) : ip;
    const now = Date.now();
    const cutoff = now - opts.windowMs;

    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= opts.max) {
      hits.set(key, recent);
      return next(new ApiError(429, message));
    }

    recent.push(now);
    hits.set(key, recent);

    // Sprzątanie amortyzowane — bez tego mapa rośnie w nieskończoność przy
    // rotujących się IP. Co ~1000 wpisów wyrzucamy kubełki bez świeżych trafień.
    if (hits.size > 1000) {
      for (const [k, times] of hits) {
        if (times.every((t) => t <= cutoff)) hits.delete(k);
      }
    }

    next();
  };
}
