import { Prisma } from '@prisma/client';
import { ApiError } from '../../middleware/errors';
import type { Db } from './state';
import { shortCode, uid } from './util';

/**
 * Port `applyMutation` z server.js — wszystkie 10 typów, wykonywane w transakcji.
 *
 * ZASADA NACZELNA: odwzorowanie ma być wierne AŻ DO DZIWACTW. Klienci są pisani
 * pod to zachowanie i część z tych dziwactw jest przez nie wykorzystywana
 * (np. `rounds: 0` znaczy „policz sam", a `joinParty` służy też do wznawiania
 * zamkniętego party). Każde „przy okazji poprawię" to potencjalnie zepsuta apka
 * w TestFlighcie, więc odstępstwa są tu jawnie opisane i jest ich dokładnie trzy.
 *
 * Świadomie NIE walidujemy payloadów schematami zod. Legacy nie walidowało nic,
 * więc zod odrzucałby żądania, które dziś działają. Zod pilnuje tylko koperty
 * `{type, payload}` w routes.ts.
 */

type Payload = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const arr = (v: unknown): unknown[] | undefined => (Array.isArray(v) ? v : undefined);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];

interface LegacyMatch {
  done?: boolean;
  aScore?: number;
  bScore?: number;
  aIds?: unknown;
  bIds?: unknown;
}

/** Wiersze składów dla gry. Set w `ids()` chroni przed duplikatem — klucz jest złożony. */
async function insertSides(db: Db, gameId: string, aIds: string[], bIds: string[]): Promise<void> {
  if (aIds.length) {
    await db.gamePlayerA.createMany({ data: aIds.map((playerId) => ({ gameId, playerId })) });
  }
  if (bIds.length) {
    await db.gamePlayerB.createMany({ data: bIds.map((playerId) => ({ gameId, playerId })) });
  }
}

/**
 * Odtworzenie gier turniejowych po każdej zmianie turnieju — 1:1 z legacy:
 * kasujemy wszystkie gry tego turnieju i odtwarzamy je z `matches`.
 * Remisy są pomijane (`aScore !== bScore`), `mode` bierze się ze `scoring`
 * turnieju, nie z jego `mode`, a `ts` to `createdAt + kolejny numer meczu`.
 *
 * Usunięcie Game kaskaduje na GamePlayerA/B (onDelete: Cascade w schemacie).
 */
async function syncTourGames(
  db: Db,
  tournament: { id: string; createdAt: Date; scoring: string; matches: Prisma.JsonValue },
): Promise<void> {
  await db.game.deleteMany({ where: { tournamentId: tournament.id } });

  const matches = (Array.isArray(tournament.matches) ? tournament.matches : []) as LegacyMatch[];
  const mode = tournament.scoring === 'classic' ? 'klasyk' : 'americano';
  const base = tournament.createdAt.getTime();

  let i = 0;
  for (const m of matches) {
    if (!m.done) continue;
    if (m.aScore === m.bScore) continue;

    i += 1;
    const gameId = uid('g');
    await db.game.create({
      data: {
        id: gameId,
        ts: new Date(base + i),
        mode,
        tournamentId: tournament.id,
        partyId: null,
        aScore: m.aScore ?? 0,
        bScore: m.bScore ?? 0,
      },
    });
    await insertSides(db, gameId, ids(m.aIds), ids(m.bIds));
  }
}

/** Demo: 7 sztywnych graczy (dodawanych tylko gdy nie ma gracza o tej nazwie) + 24 losowe gierki. */
async function seedDemo(db: Db): Promise<void> {
  const demo: Array<[string, string, string]> = [
    ['Kuba', '🦁', '#FF9F1A'],
    ['Ola', '🦊', '#FF4D8D'],
    ['Michał', '🦈', '#2D6CFF'],
    ['Zosia', '⚡', '#12B886'],
    ['Bartek', '🐉', '#6C5CE7'],
    ['Ewa', '👑', '#FF5A5F'],
    ['Piotr', '🚀', '#66D01A'],
  ];

  const existing = await db.player.findMany({ select: { name: true } });
  const haveName = new Set(existing.map((p) => p.name));

  // createdAt rozsuwany o milisekundę: legacy trzymało kolejność wstawiania
  // w tablicy, my odtwarzamy ją sortowaniem po createdAt (patrz state.ts).
  const base = Date.now();
  let offset = 0;
  for (const [name, emoji, color] of demo) {
    if (haveName.has(name)) continue;
    offset += 1;
    await db.player.create({
      data: { id: uid('p'), name, emoji, color, createdAt: new Date(base + offset) },
    });
  }

  const pool = (await db.player.findMany({ select: { id: true } })).map((p) => p.id);
  if (!pool.length) return;

  for (let i = 0; i < 24; i++) {
    const sh = [...pool].sort(() => Math.random() - 0.5);
    const dbl = Math.random() > 0.4 && pool.length >= 4;
    const a = dbl ? [sh[0], sh[1]] : [sh[0]];
    const b = dbl ? [sh[2], sh[3]] : [sh[1]];
    const amer = Math.random() > 0.35;

    const top = amer ? 21 : 6;
    const loser = Math.floor(Math.random() * (amer ? 20 : 6));
    const aWins = Math.random() > 0.5;

    const gameId = uid('g');
    await db.game.create({
      data: {
        id: gameId,
        ts: new Date(Date.now() - (24 - i) * 3_600_000),
        mode: amer ? 'americano' : 'klasyk',
        partyId: null,
        aScore: aWins ? top : loser,
        bScore: aWins ? loser : top,
      },
    });
    await insertSides(db, gameId, ids(a), ids(b));
  }
}

export async function applyMutation(
  db: Db,
  playerId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  const p = ((payload ?? {}) as Payload) || {};

  switch (type) {
    case 'addPlayer': {
      await db.player.create({
        data: {
          id: uid('p'),
          name: (str(p.name) || 'Gracz').slice(0, 16),
          emoji: str(p.emoji) || '🎾',
          color: str(p.color) || '#6C5CE7',
        },
      });
      return;
    }

    case 'delPlayer': {
      const id = str(p.id);
      if (!id) return;

      const withAccount = await db.account.count({ where: { playerId: id } });
      if (withAccount > 0) throw new ApiError(400, 'Nie można usunąć gracza z kontem');

      // ODSTĘPSTWO 1: legacy zostawiało wiszące id gracza w aIds/bIds rozegranych
      // gierek. Tu są na to klucze obce, więc najpierw wypisujemy gracza ze składów.
      // Efekt: gierka zostaje w historii, ale bez usuniętego zawodnika.
      // (memberIds party i playerIds turniejów to zwykłe tablice bez FK — tam,
      // tak jak w legacy, wiszące id zostaje.)
      await db.gamePlayerA.deleteMany({ where: { playerId: id } });
      await db.gamePlayerB.deleteMany({ where: { playerId: id } });
      await db.player.deleteMany({ where: { id } });
      return;
    }

    case 'addGame': {
      const gameId = uid('g');
      await db.game.create({
        data: {
          id: gameId,
          ts: new Date(),
          // ODSTĘPSTWO 2: legacy zapisywało `mode`/wyniki dokładnie tak, jak
          // przyszły — także undefined. Kolumny są NOT NULL, więc brakujące
          // wartości lądują jako '' i 0 zamiast znikać z JSON-a. Żaden klient
          // nie wysyła dziś addGame bez tych pól.
          mode: str(p.mode) ?? '',
          partyId: str(p.partyId) || null,
          aScore: num(p.aScore) ?? 0,
          bScore: num(p.bScore) ?? 0,
        },
      });
      await insertSides(db, gameId, ids(p.aIds), ids(p.bIds));
      return;
    }

    case 'addParty': {
      const members = ids(p.memberIds);
      const data = {
        name: (str(p.name) || 'Party').slice(0, 24),
        hostId: playerId, // z tokenu, nigdy z payloadu
        mode: str(p.mode) || 'americano',
        memberIds: members.length ? members : [playerId],
        status: 'open',
      };

      // Legacy nie sprawdzało kolizji kodu; `code` jest @unique, więc ponawiamy.
      // 31^5 ≈ 28,6 mln kombinacji — pięć podejść to aż nadto.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.partyGroup.create({ data: { id: uid('pt'), code: shortCode(), ...data } });
          return;
        } catch (err) {
          const collision =
            err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
          if (!collision || attempt === 4) throw err;
        }
      }
      return;
    }

    case 'joinParty': {
      const code = (str(p.code) || '').toUpperCase();
      const party = await db.partyGroup.findUnique({ where: { code } });
      if (!party) throw new ApiError(400, 'Nie znaleziono kodu');

      const memberIds = party.memberIds.includes(playerId)
        ? party.memberIds
        : [...party.memberIds, playerId];

      // status='open' ustawiane BEZWARUNKOWO — legacy używa tego do wznawiania
      // zamkniętego party przez ponowne wejście kodem.
      await db.partyGroup.update({ where: { id: party.id }, data: { memberIds, status: 'open' } });
      return;
    }

    case 'updateParty': {
      const id = str(p.id);
      if (!id) return;
      const party = await db.partyGroup.findUnique({ where: { id } });
      if (!party) return; // nieistniejące id → cichy no-op i 200, jak w legacy

      // Tylko truthy pola — pusty string i pusta tablica nie nadpisują.
      const data: Prisma.PartyGroupUpdateInput = {};
      const memberIds = arr(p.memberIds);
      if (memberIds) data.memberIds = ids(memberIds);
      if (str(p.status)) data.status = str(p.status);
      if (str(p.mode)) data.mode = str(p.mode);

      await db.partyGroup.update({ where: { id }, data });
      return;
    }

    case 'addTournament': {
      await db.tournament.create({
        data: {
          id: uid('t'),
          name: (str(p.name) || 'Turniej').slice(0, 30),
          status: 'live',
          mode: str(p.mode) || 'americano',
          scoring: p.scoring === 'classic' ? 'classic' : 'points',
          pointsTarget: num(p.pointsTarget) || 24,
          weekly: Boolean(p.weekly),
          rounds: num(p.rounds) || 6, // UWAGA: 0 → 6, celowo (klient liczy rundy sam)
          courts: Math.max(1, num(p.courts) || 1),
          playerIds: ids(p.playerIds),
          teams: (arr(p.teams) ?? []) as Prisma.InputJsonValue,
          matches: (arr(p.matches) ?? []) as Prisma.InputJsonValue,
        },
      });
      return;
    }

    case 'updateTournament': {
      const id = str(p.id);
      if (!id) return;
      const tournament = await db.tournament.findUnique({ where: { id } });
      if (!tournament) return; // no-op przed syncem — jak w legacy

      const data: Prisma.TournamentUpdateInput = {};
      const matches = arr(p.matches);
      if (matches) data.matches = matches as Prisma.InputJsonValue;
      if (str(p.status)) data.status = str(p.status);

      const updated = await db.tournament.update({ where: { id }, data });

      // syncTourGames leci ZAWSZE, nawet gdy nic się nie zmieniło.
      await syncTourGames(db, updated);
      return;
    }

    case 'seedDemo': {
      await seedDemo(db);
      return;
    }

    case 'reset': {
      // Czyści rozgrywkę, ale NIE graczy ani kont. Gry kaskadują na składy.
      await db.game.deleteMany({});
      await db.partyGroup.deleteMany({});
      await db.tournament.deleteMany({});
      return;
    }

    default:
      throw new ApiError(400, 'Nieznana operacja');
  }
}
