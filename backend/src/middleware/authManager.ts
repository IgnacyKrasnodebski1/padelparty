import type { RequestHandler } from 'express';
import { prisma } from '../db';
import { bearer, readManagerToken } from '../modules/auth/tokens';
import { ApiError } from './errors';

export interface ManagerAuth {
  managerId: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      manager?: ManagerAuth;
    }
  }
}

/**
 * Sesja menedżera (token typu M). Egzekwuje ukończone 2FA: konto, które ma
 * hasło, ale nie przeszło TOTP, dostaje 401 MFA_REQUIRED — nawet jeśli skądś
 * ma ważny token. Bez tego cała obowiązkowość 2FA byłaby deklaracją.
 */
export const authManager: RequestHandler = async (req, _res, next) => {
  const managerId = readManagerToken(bearer(req.headers.authorization), 'mgr');
  if (!managerId) return next(new ApiError(401, 'unauth'));

  const manager = await prisma.managerAccount.findUnique({
    where: { id: managerId },
    select: { id: true, email: true, totpEnabled: true },
  });
  if (!manager) return next(new ApiError(401, 'unauth'));
  if (!manager.totpEnabled) return next(new ApiError(401, 'MFA_REQUIRED'));

  req.manager = { managerId: manager.id, email: manager.email };
  next();
};
