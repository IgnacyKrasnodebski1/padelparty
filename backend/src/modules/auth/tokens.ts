import jwt, { type SignOptions } from 'jsonwebtoken';

/**
 * Tokeny menedżera. Trzy różne przeznaczenia, celowo rozdzielone — token
 * z etapu setupu nie może posłużyć jako sesja, a token z pierwszego kroku
 * logowania nie może ominąć drugiego.
 *
 *   setup — po accept-invite, do konfiguracji TOTP
 *   mfa   — po kroku 1 logowania, do wymiany na sesję kodem TOTP
 *   mgr   — właściwa sesja (typ M wg contracts/api.md)
 */
export type TokenPurpose = 'setup' | 'mfa' | 'mgr';

/** Czas życia w sekundach. */
const TTL: Record<TokenPurpose, number> = {
  setup: 30 * 60,
  mfa: 5 * 60,
  mgr: 12 * 60 * 60,
};

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('Brak JWT_SECRET w env — nie można wydać tokenu menedżera.');
  return s;
}

export function signManagerToken(managerId: string, purpose: TokenPurpose): string {
  const options: SignOptions = { subject: managerId, expiresIn: TTL[purpose] };
  return jwt.sign({ purpose }, secret(), options);
}

/** Zwraca id menedżera albo null, gdy token jest nieważny lub ma inne przeznaczenie. */
export function readManagerToken(token: string, expected: TokenPurpose): string | null {
  try {
    const payload = jwt.verify(token, secret());
    if (typeof payload === 'string') return null;
    if (payload.purpose !== expected) return null;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Token z nagłówka — ta sama konwencja co u graczy. */
export function bearer(header: string | undefined): string {
  return (header ?? '').replace(/^Bearer /, '');
}
