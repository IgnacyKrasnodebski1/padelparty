import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { authPlayer } from '../../middleware/auth';
import { ApiError, notFound } from '../../middleware/errors';
import { login, logout, register } from './auth';
import { applyMutation } from './mutations';
import { loadState } from './state';

export const legacyRouter = Router();

legacyRouter.post('/api/register', register);
legacyRouter.post('/api/login', login);

legacyRouter.get('/api/state', authPlayer, async (req, res) => {
  const auth = req.account;
  if (!auth) throw new ApiError(401, 'unauth');
  res.json({ meId: auth.playerId, data: await loadState() });
});

/**
 * Koperta mutacji. Zod pilnuje TYLKO jej — payload leci do applyMutation
 * nietknięty, bo legacy go nie walidowało i klienci wysyłają tam różne rzeczy.
 * Brakujący albo nie-stringowy `type` daje w legacy „Nieznana operacja", więc
 * błąd parsowania mapujemy na dokładnie ten sam komunikat.
 */
const mutateEnvelope = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
});

legacyRouter.post('/api/mutate', authPlayer, async (req, res) => {
  const auth = req.account;
  if (!auth) throw new ApiError(401, 'unauth');

  const parsed = mutateEnvelope.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Nieznana operacja');

  const data = await prisma.$transaction(
    async (tx) => {
      await applyMutation(tx, auth.playerId, parsed.data.type, parsed.data.payload);
      return loadState(tx);
    },
    // seedDemo wstawia 7 graczy i 24 gierki po kolei — domyślne 5 s potrafi
    // nie wystarczyć na wolniejszej bazie.
    { timeout: 20_000 },
  );

  res.json({ meId: auth.playerId, data });
});

legacyRouter.post('/api/logout', authPlayer, logout);

/** Nieznane `/api/*` — legacy oddawało 404 {"error":"not found"}. */
legacyRouter.all('/api/*splat', notFound);
