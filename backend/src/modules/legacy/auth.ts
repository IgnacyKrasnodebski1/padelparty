import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { ApiError } from '../../middleware/errors';
import { loadState } from './state';
import { hashPw, newToken, uid, verifyPw } from './util';

/**
 * Konta graczy — niskotarciowe: login + hasło, bez e-maila i bez 2FA
 * (konta klubów to osobny świat, patrz modules/auth/manager.ts, T017).
 *
 * ZMIANA KONTRAKTU względem server.js: pole nazywa się `login`, nie `username`
 * — zgodnie z contracts/api.md i terminologią z CLAUDE.md („login", nigdy
 * „ksywa"). Klienci (index.html, mobile/src/store.tsx) są przestawieni w tym
 * samym commicie. Konsekwencja: build iOS sprzed tej zmiany nie zaloguje się
 * do czasu aktualizacji.
 *
 * Komunikaty błędów są częścią kontraktu — apka pokazuje je użytkownikowi
 * wprost. Uwaga przy zmianach: mobile/src/screens/Auth.tsx rozpoznaje błąd
 * sieciowy regexem /network|fetch|failed|timeout|abort/i, więc żaden komunikat
 * serwera nie może w to wpaść.
 */

const MIN_LOGIN = 2;
const MIN_PASSWORD = 3;

function readCredentials(body: unknown): { login: string; rawLogin: string; password: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const rawLogin = typeof b.login === 'string' ? b.login : '';
  const login = rawLogin.trim().toLowerCase();

  // Legacy przepuszczało hasło niebędące stringiem aż do wyjątku w scrypt (500).
  // Tu odrzucamy je od razu jako 400 — ten sam komunikat, sensowniejszy status.
  const password = typeof b.password === 'string' ? b.password : '';

  return { login, rawLogin, password };
}

export const register: RequestHandler = async (req, res) => {
  const { login, rawLogin, password } = readCredentials(req.body);

  if (login.length < MIN_LOGIN) throw new ApiError(400, 'Login min. 2 znaki');
  if (password.length < MIN_PASSWORD) throw new ApiError(400, 'Hasło min. 3 znaki');

  const token = newToken();
  const playerId = uid('p');
  const b = (req.body ?? {}) as Record<string, unknown>;

  // name fallbackuje na SUROWY login (bez trim/lowercase) — dziwactwo legacy,
  // ale to ono decyduje, jak nazywa się gracz tuż po rejestracji.
  const name = (typeof b.name === 'string' && b.name ? b.name : rawLogin).slice(0, 16);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.player.create({
        data: {
          id: playerId,
          name,
          emoji: typeof b.emoji === 'string' && b.emoji ? b.emoji : '🎾',
          color: typeof b.color === 'string' && b.color ? b.color : '#6C5CE7',
        },
      });
      await tx.account.create({
        data: { id: uid('u'), login, passHash: hashPw(password), token, playerId },
      });
    });
  } catch (err) {
    // P2002 = naruszenie unique. Przy równoległych rejestracjach na ten sam
    // login wygrywa pierwsza; druga dostaje to samo 409 co przy zwykłym duplikacie.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'Ten login jest zajęty');
    }
    throw err;
  }

  res.json({ token, meId: playerId, data: await loadState() });
};

export const login: RequestHandler = async (req, res) => {
  const { login: loginName, password } = readCredentials(req.body);

  const account = await prisma.account.findUnique({ where: { login: loginName } });

  // Jeden komunikat dla „nie ma takiego konta" i „złe hasło" — bez tego
  // endpoint działa jak wyrocznia, które loginy istnieją.
  if (!account || !verifyPw(password, account.passHash)) {
    throw new ApiError(401, 'Zły login lub hasło');
  }

  // Rotacja tokenu przy każdym logowaniu — unieważnia poprzednie sesje (legacy).
  const token = newToken();
  await prisma.account.update({ where: { id: account.id }, data: { token } });

  res.json({ token, meId: account.playerId, data: await loadState() });
};

export const logout: RequestHandler = async (req, res) => {
  const auth = req.account;
  if (!auth) throw new ApiError(401, 'unauth');

  await prisma.account.update({ where: { id: auth.accountId }, data: { token: null } });

  // Legacy zwracało pusty obiekt, nie {ok:true}. Klienci i tak ignorują treść.
  res.json({});
};
