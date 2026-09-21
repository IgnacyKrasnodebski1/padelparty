import type { RequestHandler } from 'express';
import { prisma } from '../db';
import { ApiError } from './errors';

export interface PlayerAuth {
  accountId: string;
  playerId: string;
  login: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      account?: PlayerAuth;
    }
  }
}

/**
 * Token gracza (typ P wg contracts/api.md). Zgodność z legacy jest tu krytyczna —
 * tokeny wydane przez server.js muszą dalej działać:
 *  - ten sam sposób wyciągania: `(authorization || '').replace(/^Bearer /, '')`,
 *    czyli dokładnie jedna spacja i wielkość liter ma znaczenie,
 *  - token nieprefiksowany też przejdzie (replace go nie ruszy) — tak jak w legacy,
 *  - pusty token nigdy nie trafi w wylogowane konto, bo `Account.token` jest wtedy NULL.
 */
export const authPlayer: RequestHandler = async (req, _res, next) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (!token) return next(new ApiError(401, 'unauth'));

  const account = await prisma.account.findUnique({
    where: { token },
    select: { id: true, playerId: true, login: true },
  });
  if (!account) return next(new ApiError(401, 'unauth'));

  req.account = { accountId: account.id, playerId: account.playerId, login: account.login };
  next();
};
