import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { prisma } from '../../db';
import { hashSecret, verifySecret } from '../../lib/scrypt';
import { authManager } from '../../middleware/authManager';
import { ApiError } from '../../middleware/errors';
import { rateLimit } from '../../middleware/rateLimit';
import { MIN_SCORE, passwordScore } from './password';
import { bearer, readManagerToken, signManagerToken } from './tokens';

/**
 * Konta menedżerów klubów — e-mail + silne hasło + OBOWIĄZKOWE 2FA (TOTP).
 * Onboarding jest kuratorowany: konto powstaje z zaproszenia (seed / panel
 * platformy), nie z publicznej rejestracji.
 *
 * Przepływ wg contracts/api.md §1:
 *   accept-invite → {setupToken}
 *   totp/setup    [setupToken] → {otpauthUrl, backupCodes}
 *   totp/verify   [setupToken] {code} → {token}      ← DOPIERO TU konto jest aktywne
 *   login         {email,password} → {mfaToken}
 *   login/totp    {mfaToken,code|backupCode} → {token}
 */
export const managerRouter = Router();

const BACKUP_CODE_COUNT = 10;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function backupCode(): string {
  let out = '';
  for (let i = 0; i < 10; i++) {
    if (i === 5) out += '-';
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

const normalizeCode = (v: string): string => v.trim().toUpperCase().replace(/\s+/g, '');

/**
 * Wrażliwe endpointy: 5 prób na minutę z jednego IP (wymóg T102, spięty od razu).
 * Każdy endpoint dostaje WŁASNY kubełek — inaczej nieudane próby zaproszenia
 * zjadałyby limit logowania i odwrotnie.
 */
const sensitive = (): ReturnType<typeof rateLimit> => rateLimit({ windowMs: 60_000, max: 5 });

// ── accept-invite ─────────────────────────────────────────────────────────
const acceptSchema = z.object({
  inviteToken: z.string().min(1),
  email: z.string().min(3),
  password: z.string().min(1),
});

managerRouter.post('/api/mgr/accept-invite', sensitive(), async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Niekompletne dane zaproszenia');

  const { inviteToken, password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const manager = await prisma.managerAccount.findUnique({ where: { inviteToken } });

  // Jeden komunikat dla „nie ma takiego zaproszenia", „już zużyte" i „nie ten
  // e-mail" — inaczej endpoint podpowiada, które zaproszenia są ważne.
  if (!manager || manager.email.toLowerCase() !== email) {
    throw new ApiError(400, 'Zaproszenie jest nieprawidłowe lub zostało już użyte');
  }

  if (passwordScore(password, [email, 'padelparty', 'padel']) < MIN_SCORE) {
    throw new ApiError(
      400,
      'Hasło jest za słabe — najlepiej dłuższa fraza z kilku słów, min. 12 znaków',
    );
  }

  await prisma.managerAccount.update({
    where: { id: manager.id },
    data: { passHash: hashSecret(password), emailVerified: true, inviteToken: null },
  });

  res.json({ setupToken: signManagerToken(manager.id, 'setup') });
});

// ── TOTP: konfiguracja ────────────────────────────────────────────────────
managerRouter.post('/api/mgr/totp/setup', sensitive(), async (req, res) => {
  const managerId = readManagerToken(bearer(req.headers.authorization), 'setup');
  if (!managerId) throw new ApiError(401, 'unauth');

  const manager = await prisma.managerAccount.findUnique({ where: { id: managerId } });
  if (!manager) throw new ApiError(401, 'unauth');

  const secret = authenticator.generateSecret();
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, backupCode);

  // Sekret zapisujemy, ale totpEnabled zostaje false aż do verify — dopóki
  // ktoś nie pokaże działającego kodu, konto nie jest użyteczne.
  await prisma.managerAccount.update({
    where: { id: manager.id },
    data: { totpSecret: secret, totpEnabled: false, backupCodes: codes.map(hashSecret) },
  });

  // Kody zapasowe pokazujemy RAZ, jawnym tekstem; w bazie leżą tylko ich hashe.
  res.json({
    otpauthUrl: authenticator.keyuri(manager.email, 'PadelParty', secret),
    backupCodes: codes,
  });
});

const codeSchema = z.object({ code: z.string().min(1) });

managerRouter.post('/api/mgr/totp/verify', sensitive(), async (req, res) => {
  const managerId = readManagerToken(bearer(req.headers.authorization), 'setup');
  if (!managerId) throw new ApiError(401, 'unauth');

  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Podaj kod z aplikacji');

  const manager = await prisma.managerAccount.findUnique({ where: { id: managerId } });
  if (!manager?.totpSecret) throw new ApiError(400, 'Najpierw skonfiguruj aplikację 2FA');

  if (!authenticator.check(normalizeCode(parsed.data.code), manager.totpSecret)) {
    throw new ApiError(401, 'Nieprawidłowy kod');
  }

  await prisma.managerAccount.update({
    where: { id: manager.id },
    data: { totpEnabled: true, lastLoginAt: new Date() },
  });

  res.json({ token: signManagerToken(manager.id, 'mgr') });
});

// ── logowanie dwukrokowe ──────────────────────────────────────────────────
const loginSchema = z.object({ email: z.string().min(3), password: z.string().min(1) });

managerRouter.post('/api/mgr/login', sensitive(), async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(401, 'Zły e-mail lub hasło');

  const email = parsed.data.email.trim().toLowerCase();
  const manager = await prisma.managerAccount.findUnique({ where: { email } });

  if (!manager?.passHash || !verifySecret(parsed.data.password, manager.passHash)) {
    throw new ApiError(401, 'Zły e-mail lub hasło');
  }

  // Konto z poprawnym hasłem, ale bez ukończonego 2FA, nie dostaje sesji —
  // musi dokończyć setup. Kod z kontraktu: 401 MFA_REQUIRED.
  if (!manager.totpEnabled) throw new ApiError(401, 'MFA_REQUIRED');

  res.json({ mfaToken: signManagerToken(manager.id, 'mfa') });
});

const totpLoginSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(1).optional(),
  backupCode: z.string().min(1).optional(),
});

managerRouter.post('/api/mgr/login/totp', sensitive(), async (req, res) => {
  const parsed = totpLoginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Podaj kod z aplikacji albo kod zapasowy');

  const managerId = readManagerToken(parsed.data.mfaToken, 'mfa');
  if (!managerId) throw new ApiError(401, 'Sesja logowania wygasła — zaloguj się jeszcze raz');

  const manager = await prisma.managerAccount.findUnique({ where: { id: managerId } });
  if (!manager?.totpSecret || !manager.totpEnabled) throw new ApiError(401, 'MFA_REQUIRED');

  const code = parsed.data.code ? normalizeCode(parsed.data.code) : undefined;
  const backup = parsed.data.backupCode ? normalizeCode(parsed.data.backupCode) : undefined;

  if (code) {
    if (!authenticator.check(code, manager.totpSecret)) throw new ApiError(401, 'Nieprawidłowy kod');
  } else if (backup) {
    const idx = manager.backupCodes.findIndex((stored) => verifySecret(backup, stored));
    if (idx < 0) throw new ApiError(401, 'Nieprawidłowy kod zapasowy');

    // Kod zapasowy jest jednorazowy — zużyty znika z listy.
    const left = manager.backupCodes.filter((_, i) => i !== idx);
    await prisma.managerAccount.update({ where: { id: manager.id }, data: { backupCodes: left } });
  } else {
    throw new ApiError(400, 'Podaj kod z aplikacji albo kod zapasowy');
  }

  await prisma.managerAccount.update({
    where: { id: manager.id },
    data: { lastLoginAt: new Date() },
  });

  res.json({ token: signManagerToken(manager.id, 'mgr') });
});

// ── sesja ─────────────────────────────────────────────────────────────────
managerRouter.post('/api/mgr/logout', authManager, (_req, res) => {
  // Sesja menedżera to JWT bez stanu po stronie serwera — wylogowanie polega
  // na porzuceniu tokenu przez klienta. Endpoint istnieje, bo jest w kontrakcie
  // i bo panel potrzebuje jednego miejsca na wyczyszczenie sesji.
  res.json({});
});

managerRouter.get('/api/mgr/me', authManager, async (req, res) => {
  const auth = req.manager;
  if (!auth) throw new ApiError(401, 'unauth');

  const memberships = await prisma.managerMembership.findMany({
    where: { managerId: auth.managerId },
    include: { club: { select: { id: true, slug: true, name: true, status: true } } },
  });

  res.json({
    email: auth.email,
    clubs: memberships.map((m) => ({ ...m.club, role: m.role })),
  });
});
