import { randomBytes, randomInt } from 'node:crypto';

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
 * Hasła graczy — wspólna implementacja scrypt z lib/scrypt.ts (ten sam format
 * `saltHex:hashHex`, którego używał server.js). Aliasy zostawione pod starymi
 * nazwami, bo tak nazywa je legacy.
 */
export { hashSecret as hashPw, verifySecret as verifyPw } from '../../lib/scrypt';

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
