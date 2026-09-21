/**
 * Jedyne miejsce, w którym wiersze Prismy zamieniają się w legacy JSON.
 * Wszystko, co klienci widzą w `data`, przechodzi przez ten plik — jeśli kształt
 * ma się nie rozjechać z server.js, to pilnujemy go TUTAJ, nigdzie indziej.
 *
 * Trzy pułapki, przez które ten moduł w ogóle istnieje:
 *
 *  1. CZASY. Legacy trzyma `ts`/`createdAt` jako epoch ms (number), Prisma jako
 *     DateTime. Klient robi na tym arytmetykę — `Date.now() - ts` w timeAgo oraz
 *     sortowanie `a.ts - b.ts` (mobile/src/logic.ts). ISO string po cichu rozwala
 *     historię i kolejność. Zawsze .getTime().
 *
 *  2. SKŁADY. Legacy ma `aIds`/`bIds` jako tablice w rekordzie gry; my mamy tabele
 *     GamePlayerA/GamePlayerB z kluczem złożonym @@id([gameId, playerId]), który
 *     NIE przechowuje kolejności. Sortujemy po playerId, żeby wynik był
 *     deterministyczny. ODSTĘPSTWO: kolejność w tablicy może się różnić od tej,
 *     którą wysłał klient. Semantycznie bez znaczenia — strony A/B są zbiorami
 *     przy liczeniu ELO i statystyk. Gdyby kiedyś zaczęła mieć znaczenie,
 *     lekarstwem jest migracja dokładająca kolumnę pozycji.
 *
 *  3. tournamentId. Legacy ustawia je tylko na grach z turnieju; gry ręczne nie
 *     mają tego klucza W OGÓLE (undefined znika przy JSON.stringify). `partyId`
 *     odwrotnie — jest zawsze, jawnie null.
 */
import type { Game, GamePlayerA, GamePlayerB, PartyGroup, Player, Tournament } from '@prisma/client';

export interface LegacyPlayer {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface LegacyGame {
  id: string;
  ts: number;
  mode: string;
  partyId: string | null;
  tournamentId?: string;
  aIds: string[];
  bIds: string[];
  aScore: number;
  bScore: number;
}

export interface LegacyParty {
  id: string;
  name: string;
  code: string;
  hostId: string;
  mode: string;
  memberIds: string[];
  status: string;
  createdAt: number;
}

export interface LegacyTournament {
  id: string;
  name: string;
  status: string;
  createdAt: number;
  mode: string;
  scoring: string;
  pointsTarget: number;
  weekly: boolean;
  rounds: number;
  courts: number;
  playerIds: string[];
  teams: unknown;
  matches: unknown;
}

export interface LegacyData {
  players: LegacyPlayer[];
  games: LegacyGame[];
  parties: LegacyParty[];
  tournaments: LegacyTournament[];
}

export type GameWithSides = Game & { playersA: GamePlayerA[]; playersB: GamePlayerB[] };

/** Legacy player nie ma createdAt — celowo go nie wypuszczamy. */
export function toLegacyPlayer(p: Player): LegacyPlayer {
  return { id: p.id, name: p.name, emoji: p.emoji, color: p.color };
}

export function toLegacyGame(g: GameWithSides): LegacyGame {
  const game: LegacyGame = {
    id: g.id,
    ts: g.ts.getTime(),
    mode: g.mode,
    partyId: g.partyId,
    aIds: g.playersA.map((r) => r.playerId).sort(),
    bIds: g.playersB.map((r) => r.playerId).sort(),
    aScore: g.aScore,
    bScore: g.bScore,
  };
  if (g.tournamentId !== null) game.tournamentId = g.tournamentId;
  return game;
}

export function toLegacyParty(p: PartyGroup): LegacyParty {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    hostId: p.hostId,
    mode: p.mode,
    memberIds: p.memberIds,
    status: p.status,
    createdAt: p.createdAt.getTime(),
  };
}

export function toLegacyTournament(t: Tournament): LegacyTournament {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    createdAt: t.createdAt.getTime(),
    mode: t.mode,
    scoring: t.scoring,
    pointsTarget: t.pointsTarget,
    weekly: t.weekly,
    rounds: t.rounds,
    courts: t.courts,
    playerIds: t.playerIds,
    // teams jest nullable w bazie, ale legacy zawsze miało tablicę.
    teams: t.teams ?? [],
    matches: t.matches,
  };
}
