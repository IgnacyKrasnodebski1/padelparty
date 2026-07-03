import { API_URL } from './config';

export type Player = { id: string; name: string; emoji: string; color: string };
export type Game = { id: string; ts: number; mode: 'americano' | 'klasyk'; partyId?: string | null; tournamentId?: string; aIds: string[]; bIds: string[]; aScore: number; bScore: number };
export type Party = { id: string; name: string; code: string; hostId: string; mode: string; memberIds: string[]; status: 'open' | 'playing' | 'done'; createdAt: number };
export type Match = { id: string; round: number; aIds: string[]; bIds: string[]; aScore: number; bScore: number; done: boolean };
export type TourMode = 'americano' | 'mexicano' | 'americano_pairs' | 'mexicano_pairs';
export type Scoring = 'points' | 'classic';
export type Tournament = {
  id: string; name: string; createdAt: number; status: 'live' | 'done';
  mode: TourMode; scoring: Scoring; pointsTarget: number;
  weekly: boolean; rounds: number;
  playerIds: string[];       // uczestnicy (tryby indywidualne)
  teams?: string[][];        // stałe pary [[p1,p2],[p3,p4]] (tryby _pairs)
  matches: Match[];
};
export type Data = { players: Player[]; games: Game[]; parties: Party[]; tournaments: Tournament[] };

export const emptyData = (): Data => ({ players: [], games: [], parties: [], tournaments: [] });
export const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9);

export const COLORS = ['#6C5CE7', '#2D6CFF', '#12B886', '#FF5A5F', '#FF9F1A', '#FF4D8D', '#66D01A', '#00B8D9'];
export const EMOJIS = ['🎾', '🔥', '⚡', '🦁', '🐺', '🦊', '🦈', '🐉', '🚀', '👑', '💎', '🎯', '🏆', '🥊', '🌟', '🍕', '🦖', '🐼', '🦅', '🎸', '🤠'];

export const MODE_INFO: Record<TourMode, { emoji: string; name: string; desc: string; pairs: boolean; mexicano: boolean }> = {
  americano: { emoji: '🎾', name: 'Americano', desc: 'Co rundę inny partner, grasz z każdym. Punkty indywidualne.', pairs: false, mexicano: false },
  mexicano: { emoji: '🌶️', name: 'Mexicano', desc: 'Jak Americano, ale pary wg rankingu na żywo — wyrównane mecze.', pairs: false, mexicano: true },
  americano_pairs: { emoji: '👥', name: 'Americano w parach', desc: 'Stałe pary, każda gra z każdą (round-robin).', pairs: true, mexicano: false },
  mexicano_pairs: { emoji: '🌶️👥', name: 'Mexicano w parach', desc: 'Stałe pary kojarzone wg rankingu — najlepsi z najlepszymi.', pairs: true, mexicano: true },
};
export const isPairs = (m: TourMode) => MODE_INFO[m].pairs;
export const isMexicano = (m: TourMode) => MODE_INFO[m].mexicano;
export const POINT_TARGETS = [16, 21, 24, 32];

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const teamKey = (ids: string[]) => [...ids].sort().join('|');

export async function api(path: string, method?: string, body?: any, token?: string | null) {
  const r = await fetch(API_URL + path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j: any = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || 'Błąd serwera');
  return j;
}

export function pget(data: Data, id: string) { return data.players.find(p => p.id === id); }
export function names(data: Data, ids: string[]) { return ids.map(id => pget(data, id)?.name || '?').join(' + '); }
export function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'przed chwilą';
  if (s < 3600) return Math.floor(s / 60) + ' min temu';
  if (s < 86400) return Math.floor(s / 3600) + ' godz temu';
  return Math.floor(s / 86400) + ' dni temu';
}

export type Stat = { id: string; elo: number; wins: number; losses: number; draws: number; played: number; points: number; amerPts: number; cur: number; best: number; wr: number };
export function computeStats(data: Data): Record<string, Stat> {
  const st: Record<string, Stat> = {};
  const init = (id: string) => (st[id] = { id, elo: 1000, wins: 0, losses: 0, draws: 0, played: 0, points: 0, amerPts: 0, cur: 0, best: 0, wr: 0 });
  data.players.forEach(p => init(p.id));
  const gs = [...data.games].sort((a, b) => a.ts - b.ts);
  gs.forEach(g => {
    const A = g.aIds, B = g.bIds;
    if (!A.length || !B.length) return;
    A.concat(B).forEach(id => { if (!st[id]) init(id); });
    const eA = A.reduce((s, i) => s + st[i].elo, 0) / A.length, eB = B.reduce((s, i) => s + st[i].elo, 0) / B.length;
    const expA = 1 / (1 + Math.pow(10, (eB - eA) / 400));
    const rA = g.aScore > g.bScore ? 1 : g.aScore < g.bScore ? 0 : 0.5;
    const K = 32;
    A.forEach(i => (st[i].elo += K * (rA - expA)));
    B.forEach(i => (st[i].elo += K * ((1 - rA) - (1 - expA))));
    A.forEach(i => { st[i].played++; st[i].points += g.aScore; if (g.mode === 'americano') st[i].amerPts += g.aScore; });
    B.forEach(i => { st[i].played++; st[i].points += g.bScore; if (g.mode === 'americano') st[i].amerPts += g.bScore; });
    if (rA === 1) { A.forEach(i => { st[i].wins++; st[i].cur++; st[i].best = Math.max(st[i].best, st[i].cur); }); B.forEach(i => { st[i].losses++; st[i].cur = 0; }); }
    else if (rA === 0) { B.forEach(i => { st[i].wins++; st[i].cur++; st[i].best = Math.max(st[i].best, st[i].cur); }); A.forEach(i => { st[i].losses++; st[i].cur = 0; }); }
    else A.concat(B).forEach(i => st[i].draws++);
  });
  Object.values(st).forEach(s => { s.elo = Math.round(s.elo); s.wr = s.played ? Math.round((s.wins / s.played) * 100) : 0; });
  return st;
}

export type RankDef = { name: string; emoji: string; desc: string; key: (s: Stat) => number; fmt: (s: Stat) => string; sub: (s: Stat) => string };
export const RANKS: Record<string, RankDef> = {
  elo: { name: 'Ranking Generalny', emoji: '🏆', desc: 'Ogólny poziom (ELO)', key: s => s.elo, fmt: s => String(s.elo), sub: s => `${s.wins}W ${s.losses}L` },
  wins: { name: 'Zwycięzcy', emoji: '🔥', desc: 'Najwięcej wygranych', key: s => s.wins, fmt: s => s.wins + ' W', sub: s => `${s.wr}% skuteczności` },
  amer: { name: 'Król Americano', emoji: '🎯', desc: 'Punkty w Americano', key: s => s.amerPts, fmt: s => s.amerPts + ' pkt', sub: s => `${s.played} gier` },
  streak: { name: 'Na fali', emoji: '⚡', desc: 'Aktualna passa', key: s => s.cur, fmt: s => s.cur + ' 🔥', sub: s => `rekord: ${s.best}` },
  active: { name: 'Maszyny', emoji: '🏓', desc: 'Najwięcej gier', key: s => s.played, fmt: s => String(s.played), sub: s => `${s.wins}W ${s.losses}L` },
};

const mkMatch = (round: number, a: string[], b: string[]): Match => ({ id: uid('m'), round, aIds: a, bIds: b, aScore: 0, bScore: 0, done: false });

// AMERICANO (indywidualne): greedy rotacja partnerów, minimalizuje powtórki. N wielokrotność 4.
export function genAmericano(ids: string[], rounds: number): Match[] {
  const pool = ids.slice(0, Math.floor(ids.length / 4) * 4);
  if (pool.length < 4) return [];
  const pc: Record<string, number> = {};
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const M: Match[] = [];
  for (let r = 1; r <= rounds; r++) {
    const order = shuffle(pool), used = new Set<string>(), pairs: string[][] = [];
    for (const p of order) {
      if (used.has(p)) continue; used.add(p);
      let best: string | null = null, bestc = Infinity;
      for (const q of order) { if (used.has(q)) continue; const c = pc[key(p, q)] || 0; if (c < bestc) { bestc = c; best = q; } }
      if (best) { used.add(best); pairs.push([p, best]); pc[key(p, best)] = (pc[key(p, best)] || 0) + 1; }
    }
    const sp = shuffle(pairs);
    for (let i = 0; i + 1 < sp.length; i += 2) M.push(mkMatch(r, sp[i], sp[i + 1]));
  }
  return M;
}
// MEXICANO (indywidualne): runda 1 losowo; kolejne wg rankingu (1+4 vs 2+3).
function mexRound(sorted: string[], round: number): Match[] {
  const M: Match[] = [];
  for (let i = 0; i + 3 < sorted.length; i += 4) M.push(mkMatch(round, [sorted[i], sorted[i + 3]], [sorted[i + 1], sorted[i + 2]]));
  return M;
}
export const genMexicanoFirst = (ids: string[]) => mexRound(shuffle(ids.slice(0, Math.floor(ids.length / 4) * 4)), 1);

// AMERICANO W PARACH: round-robin stałych par (metoda okręgu).
export function genTeamRoundRobin(teams: string[][], rounds: number): Match[] {
  if (teams.length < 2) return [];
  let list: number[] = teams.map((_, i) => i);
  if (list.length % 2) list.push(-1);
  const T = list.length, maxR = Math.min(rounds || T - 1, T - 1), M: Match[] = [];
  let rot = list.slice();
  for (let r = 1; r <= maxR; r++) {
    for (let i = 0; i < T / 2; i++) { const a = rot[i], b = rot[T - 1 - i]; if (a >= 0 && b >= 0) M.push(mkMatch(r, teams[a], teams[b])); }
    rot = [rot[0], ...rot.slice(-1), ...rot.slice(1, -1)];
  }
  return M;
}
// MEXICANO W PARACH: runda 1 losowo; kolejne wg rankingu par (1v2, 3v4...).
function teamMexRound(teams: string[][], order: number[], round: number): Match[] {
  const M: Match[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) M.push(mkMatch(round, teams[order[i]], teams[order[i + 1]]));
  return M;
}
export const genTeamMexFirst = (teams: string[][]) => teamMexRound(teams, shuffle(teams.map((_, i) => i)), 1);

// Generuj początkowe mecze wg trybu
export function genInitial(t: Pick<Tournament, 'mode' | 'playerIds' | 'teams' | 'rounds'>): Match[] {
  if (t.mode === 'americano') return genAmericano(t.playerIds, t.rounds);
  if (t.mode === 'mexicano') return genMexicanoFirst(t.playerIds);
  if (t.mode === 'americano_pairs') return genTeamRoundRobin(t.teams || [], t.rounds);
  return genTeamMexFirst(t.teams || []);
}
// Następna runda (tylko Mexicano/Mexicano w parach) — wg aktualnego rankingu
export function nextRound(t: Tournament): Match[] {
  const nextR = (t.matches.reduce((m, x) => Math.max(m, x.round), 0)) + 1;
  if (t.mode === 'mexicano') return mexRound(tourStandings(t).map(s => s.id), nextR);
  if (t.mode === 'mexicano_pairs') return teamMexRound(t.teams || [], teamStandings(t).map(s => s.idx), nextR);
  return [];
}
export const roundComplete = (t: Tournament, round: number) => {
  const ms = t.matches.filter(m => m.round === round);
  return ms.length > 0 && ms.every(m => m.done);
};

export function tourStandings(t: Tournament) {
  const st: Record<string, { id: string; pts: number; wins: number; played: number }> = {};
  t.playerIds.forEach(id => (st[id] = { id, pts: 0, wins: 0, played: 0 }));
  t.matches.filter(m => m.done).forEach(m => {
    m.aIds.forEach(i => { if (st[i]) { st[i].pts += m.aScore; st[i].played++; } });
    m.bIds.forEach(i => { if (st[i]) { st[i].pts += m.bScore; st[i].played++; } });
    if (m.aScore > m.bScore) m.aIds.forEach(i => st[i] && st[i].wins++);
    else if (m.bScore > m.aScore) m.bIds.forEach(i => st[i] && st[i].wins++);
  });
  return Object.values(st).sort((a, b) => (t.scoring === 'classic' ? b.wins - a.wins || b.pts - a.pts : b.pts - a.pts || b.wins - a.wins));
}
export function teamStandings(t: Tournament) {
  const teams = t.teams || [];
  const map: Record<string, { idx: number; pts: number; wins: number; played: number }> = {};
  teams.forEach((tm, i) => (map[teamKey(tm)] = { idx: i, pts: 0, wins: 0, played: 0 }));
  t.matches.filter(m => m.done).forEach(m => {
    const ka = teamKey(m.aIds), kb = teamKey(m.bIds);
    if (map[ka]) { map[ka].pts += m.aScore; map[ka].played++; }
    if (map[kb]) { map[kb].pts += m.bScore; map[kb].played++; }
    if (m.aScore > m.bScore && map[ka]) map[ka].wins++; else if (m.bScore > m.aScore && map[kb]) map[kb].wins++;
  });
  return Object.values(map).sort((a, b) => (t.scoring === 'classic' ? b.wins - a.wins || b.pts - a.pts : b.pts - a.pts || b.wins - a.wins));
}
