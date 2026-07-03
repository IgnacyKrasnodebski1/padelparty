import { API_URL } from './config';

export type Player = { id: string; name: string; emoji: string; color: string };
export type Game = { id: string; ts: number; mode: 'americano' | 'klasyk'; partyId?: string | null; tournamentId?: string; aIds: string[]; bIds: string[]; aScore: number; bScore: number };
export type Party = { id: string; name: string; code: string; hostId: string; mode: string; memberIds: string[]; status: 'open' | 'playing' | 'done'; createdAt: number };
export type Match = { id: string; round: number; court?: number; aIds: string[]; bIds: string[]; aScore: number; bScore: number; done: boolean };
export type TourMode = 'americano' | 'mexicano' | 'americano_pairs' | 'mexicano_pairs';
export type Scoring = 'points' | 'classic';
export type Tournament = {
  id: string; name: string; createdAt: number; status: 'live' | 'done';
  mode: TourMode; scoring: Scoring; pointsTarget: number;
  weekly: boolean; rounds: number; courts: number;
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 70000); // do 70s (cold start darmowego hostingu)
  try {
    const r = await fetch(API_URL + path, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    let j: any = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw new Error(j.error || 'Błąd serwera');
    return j;
  } finally { clearTimeout(timer); }
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

type TBuild = Pick<Tournament, 'mode' | 'scoring' | 'playerIds' | 'teams' | 'courts' | 'matches'>;

// ile meczów rozegrał każdy gracz / każda para (do sprawiedliwej rotacji pauz)
function playedByPlayer(t: TBuild): Record<string, number> {
  const p: Record<string, number> = {}; t.playerIds.forEach(id => (p[id] = 0));
  t.matches.forEach(m => [...m.aIds, ...m.bIds].forEach(id => { if (p[id] != null) p[id]++; }));
  return p;
}
function playedByTeam(t: TBuild): Record<string, number> {
  const p: Record<string, number> = {}; (t.teams || []).forEach(tm => (p[teamKey(tm)] = 0));
  t.matches.forEach(m => { const ka = teamKey(m.aIds), kb = teamKey(m.bIds); if (p[ka] != null) p[ka]++; if (p[kb] != null) p[kb]++; });
  return p;
}
// greedy: ustaw graczy tak, by kolejne pary [0,1],[2,3]… miały jak najmniej powtórzonych partnerów
function partnerOrder(players: string[], matches: Match[]): string[] {
  const pc: Record<string, number> = {};
  matches.forEach(m => { [m.aIds, m.bIds].forEach(ids => { if (ids.length === 2) { const k = teamKey(ids); pc[k] = (pc[k] || 0) + 1; } }); });
  const rem = shuffle(players), out: string[] = [];
  while (rem.length >= 2) {
    const a = rem.shift()!; let bi = 0, bc = Infinity;
    for (let i = 0; i < rem.length; i++) { const c = pc[teamKey([a, rem[i]])] || 0; if (c < bc) { bc = c; bi = i; } }
    out.push(a, rem.splice(bi, 1)[0]);
  }
  return out;
}
// greedy: ustaw pary (indeksy) tak, by kolejni przeciwnicy [0,1],[2,3]… mieli najmniej powtórek
function opponentOrder(idx: number[], teams: string[][], matches: Match[]): number[] {
  const oc: Record<string, number> = {}; const key = (a: number, b: number) => [a, b].sort((x, y) => x - y).join('-');
  matches.forEach(m => { const ai = teams.findIndex(t => teamKey(t) === teamKey(m.aIds)), bi = teams.findIndex(t => teamKey(t) === teamKey(m.bIds)); if (ai >= 0 && bi >= 0) oc[key(ai, bi)] = (oc[key(ai, bi)] || 0) + 1; });
  const rem = shuffle(idx), out: number[] = [];
  while (rem.length >= 2) {
    const a = rem.shift()!; let bi = 0, bc = Infinity;
    for (let i = 0; i < rem.length; i++) { const c = oc[key(a, rem[i])] || 0; if (c < bc) { bc = c; bi = i; } }
    out.push(a, rem.splice(bi, 1)[0]);
  }
  return out;
}

// GŁÓWNY generator: buduje JEDNĄ rundę na bieżąco (korty + rotacja pauz + Mexicano wg rankingu na żywo)
export function buildRound(t: TBuild, roundNum: number): Match[] {
  const M: Match[] = [];
  const first = (t.matches || []).length === 0;
  const courts = Math.max(1, t.courts || 1);

  if (isPairs(t.mode)) {
    const teams = t.teams || []; if (teams.length < 2) return [];
    const played = playedByTeam(t as Tournament);
    const cap = Math.min(Math.floor(teams.length / 2) * 2, courts * 2);
    const order = teams.map((_, i) => i).sort((a, b) => (played[teamKey(teams[a])] - played[teamKey(teams[b])]) || (Math.random() - 0.5));
    const playing = order.slice(0, cap);
    let seq: number[];
    if (t.mode === 'mexicano_pairs' && !first) { const rank: Record<number, number> = {}; teamStandings(t as Tournament).forEach((s, i) => (rank[s.idx] = i)); seq = [...playing].sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0)); }
    else seq = opponentOrder(playing, teams, t.matches);
    for (let i = 0; i + 1 < seq.length; i += 2) M.push({ id: uid('m'), round: roundNum, court: i / 2 + 1, aIds: teams[seq[i]], bIds: teams[seq[i + 1]], aScore: 0, bScore: 0, done: false });
    return M;
  }

  const N = t.playerIds.length; if (N < 4) return [];
  const played = playedByPlayer(t as Tournament);
  const cap = Math.min(Math.floor(N / 4) * 4, courts * 4);
  const order = [...t.playerIds].sort((a, b) => (played[a] - played[b]) || (Math.random() - 0.5));
  const playing = order.slice(0, cap);
  let seq: string[];
  if (t.mode === 'mexicano' && !first) { const rank: Record<string, number> = {}; tourStandings(t as Tournament).forEach((s, i) => (rank[s.id] = i)); seq = [...playing].sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0)); }
  else if (t.mode === 'americano') seq = partnerOrder(playing, t.matches);
  else seq = shuffle(playing);
  for (let i = 0; i + 3 < seq.length; i += 4) {
    const g = [seq[i], seq[i + 1], seq[i + 2], seq[i + 3]];
    const [A, B] = t.mode === 'mexicano' ? [[g[0], g[3]], [g[1], g[2]]] : [[g[0], g[1]], [g[2], g[3]]];
    M.push({ id: uid('m'), round: roundNum, court: i / 4 + 1, aIds: A, bIds: B, aScore: 0, bScore: 0, done: false });
  }
  return M;
}

export const genInitial = (t: TBuild): Match[] => buildRound({ ...t, matches: [] }, 1);
export function nextRound(t: Tournament): Match[] {
  return buildRound(t, t.matches.reduce((m, x) => Math.max(m, x.round), 0) + 1);
}
export const maxRound = (t: Tournament) => t.matches.reduce((m, x) => Math.max(m, x.round), 0);
export const roundComplete = (t: Tournament, round: number) => {
  const ms = t.matches.filter(m => m.round === round);
  return ms.length > 0 && ms.every(m => m.done);
};
// kto pauzuje w danej rundzie
export function sittingOut(t: Tournament, round: number): string[] {
  const inRound = new Set<string>();
  t.matches.filter(m => m.round === round).forEach(m => [...m.aIds, ...m.bIds].forEach(id => inRound.add(id)));
  const all = isPairs(t.mode) ? (t.teams || []).flat() : t.playerIds;
  return all.filter(id => !inRound.has(id));
}

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
