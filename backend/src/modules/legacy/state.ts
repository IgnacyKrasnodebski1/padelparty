import type { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import {
  toLegacyGame,
  toLegacyParty,
  toLegacyPlayer,
  toLegacyTournament,
  type LegacyData,
} from './serialize';

/** Prisma client albo klient transakcyjny — mutacje czytają stan wewnątrz transakcji. */
export type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Pełny stan aplikacji w kształcie legacy. `GET /api/state` i `POST /api/mutate`
 * zwracają go w całości — taki jest kontrakt i klienci na nim stoją (nadpisują
 * sobie cały lokalny stan odpowiedzią serwera).
 *
 * Cztery zapytania równolegle. Przy dzisiejszej skali to nieistotne; gdy dojdą
 * kluby i gierek będą dziesiątki tysięcy, `games` trzeba będzie ciąć po zakresie
 * czasu albo po klubie — wtedy zmienia się też kontrakt z klientem, więc to
 * decyzja na osobny task, nie optymalizacja po cichu.
 *
 * Kolejność: legacy oddawał tablice w kolejności wstawiania. Odtwarzamy ją przez
 * sortowanie po czasie utworzenia z `id` jako rozstrzygaczem remisów. ODSTĘPSTWO:
 * po `updateTournament` legacy dokładał gry turniejowe na KONIEC tablicy, nawet
 * jeśli ich `ts` był starszy — u nas wejdą w miejsce zgodne z `ts`. Klient i tak
 * sortuje historię po `ts`, więc widoczna kolejność się zgadza.
 */
export async function loadState(db: Db = prisma): Promise<LegacyData> {
  const [players, games, parties, tournaments] = await Promise.all([
    db.player.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.game.findMany({
      include: { playersA: true, playersB: true },
      orderBy: [{ ts: 'asc' }, { id: 'asc' }],
    }),
    db.partyGroup.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.tournament.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);

  return {
    players: players.map(toLegacyPlayer),
    games: games.map(toLegacyGame),
    parties: parties.map(toLegacyParty),
    tournaments: tournaments.map(toLegacyTournament),
  };
}
