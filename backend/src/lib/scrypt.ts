import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hasła i inne sekrety: scrypt z domyślnymi parametrami Node, zapis `saltHex:hashHex`.
 *
 * Format jest podyktowany przez legacy (server.js) — hashe przeniesione z produkcji
 * muszą dalej działać. KRYTYCZNE: sól idzie do scryptSync jako STRING hex, nie jako
 * Buffer. Legacy robiło `scryptSync(pw, saltHexString, 64)`; zdekodowanie soli do
 * bajtów daje inny hash i żadne stare konto się nie zaloguje.
 *
 * Używane zarówno dla kont graczy (modules/legacy), jak i menedżerów
 * (modules/auth) oraz dla kodów zapasowych 2FA.
 */
export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString('hex');
  const h = scryptSync(value, salt, 64).toString('hex');
  return salt + ':' + h;
}

export function verifySecret(value: string, stored: string): boolean {
  try {
    const [salt, h] = stored.split(':');
    if (salt === undefined || h === undefined) return false;
    const h2 = scryptSync(value, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(h2, 'hex'));
  } catch {
    return false;
  }
}
