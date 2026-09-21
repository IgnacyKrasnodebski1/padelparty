import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Identyfikatory w formacie legacy: prefiks + 10 znaków hex.
 * Prefiksy: p=player, u=account, g=game, pt=party, t=tournament.
 *
 * Schema ma @default(cuid()), ale podajemy `id` jawnie i zostajemy przy schemacie
 * legacy. Powód: migracja produkcji (T014) przenosi stare id bez zmian, bo są
 * używane jako referencje w aIds/bIds/memberIds/playerIds/hostId. Gdybyśmy dla
 * nowych rekordów przeszli na cuid(), baza miałaby dwa formaty id bez żadnego zysku.
 */
export function uid(prefix: string): string {
  return prefix + randomBytes(5).toString('hex');
}

/** Token sesji gracza — 48 znaków hex, jak w legacy. */
export function newToken(): string {
  return randomBytes(24).toString('hex');
}

/**
 * Hasła DOKŁADNIE jak w server.js — scrypt z domyślnymi parametrami Node,
 * zapis `saltHex:hashHex`.
 *
 * KRYTYCZNE: sól idzie do scryptSync jako STRING hex, nie jako Buffer. Legacy
 * robiło `scryptSync(pw, salt, 64)` gdzie `salt` to string z randomBytes(16).hex.
 * Zdekodowanie go do bajtów da inny hash i żadne konto przeniesione z produkcji
 * się nie zaloguje.
 */
export function hashPw(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  const h = scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + h;
}

export function verifyPw(pw: string, stored: string): boolean {
  try {
    const [salt, h] = stored.split(':');
    if (salt === undefined || h === undefined) return false;
    const h2 = scryptSync(pw, salt, 64).toString('hex');
    return timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(h2, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Kod party: 5 znaków z alfabetu bez znaków mylących (brak I, L, O, 0, 1).
 * Legacy nie sprawdzało kolizji; u nas `PartyGroup.code` jest @unique, więc
 * wołający ponawia przy zderzeniu (patrz mutations.addParty).
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function shortCode(): string {
  let c = '';
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return c;
}
