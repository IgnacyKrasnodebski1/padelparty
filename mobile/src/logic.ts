import { API_URL } from './config';

export type Player = { id: string; name: string; emoji: string; color: string };
export type Game = { id: string; ts: number; mode: 'americano' | 'klasyk'; partyId?: string | null; tournamentId?: string; aIds: string[]; bIds: string[]; aScore: number; bScore: number };
export type Party = { id: string; name: string; code: string; hostId: string; mode: string; memberIds: string[]; status: 'open' | 'playing' | 'done'; createdAt: number };
export type Match = { id: string; round: number; aIds: string[]; bIds: string[]; aScore: number; bScore: number; done: boolean };
export type Tournament = { id: string; name: string; format: '1v1' | '2v2'; weekly: boolean; rounds: number; playerIds: string[]; matches: Match[]; status: 'live' | 'done'; createdAt: number };
export type Data = { players: Player[]; games: Game[]; parties: Party[]; tournaments: Tournament[] };

export const emptyData = (): Data => ({ players: [], games: [], parties: [], tournaments: [] });
export const uid = (p = 'id') => p + Math.random().toString(36).slice(2, 9);

export const COLORS = ['#6C5CE7', '#2D6CFF', '#12B886', '#FF5A5F', '#FF9F1A', '#FF4D8D', '#66D01A', '#00B8D9'];
export const EMOJIS = ['🎾', '🔥', '⚡', '🦁', '🐺', '🦊', '🦈', '🐉', '🚀', '👑', '💎', '🎯', '🏆', '🥊', '🌟', '🍕', '🦖', '🐼', '🦅', '🎸', '🤠'];

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

export function genSchedule(ids: string[], format: '1v1' | '2v2', rounds: number): Match[] {
  const M: Match[] = [];
  const n = ids.length;
  if (format === '1v1') {
    let arr: (string | null)[] = [...ids];
    if (n % 2) arr.push(null);
    const R = arr.length, half = R / 2;
    let rnd = arr.slice();
    const maxR = Math.min(rounds || R - 1, R - 1);
    for (let r = 0; r < maxR; r++) {
      for (let i = 0; i < half; i++) {
        const a = rnd[i], b = rnd[R - 1 - i];
        if (a != null && b != null) M.push({ id: uid('m'), round: r + 1, aIds: [a], bIds: [b], aScore: 0, bScore: 0, done: false });
      }
      rnd = [rnd[0], ...rnd.slice(-1), ...rnd.slice(1, -1)];
    }
  } else {
    const base = ids.filter((_, i) => i < Math.floor(n / 4) * 4);
    const R = rounds || Math.max(3, base.length - 1);
    for (let r = 0; r < R; r++) {
      const sh = [...base].sort(() => Math.random() - 0.5);
      for (let i = 0; i + 3 < sh.length; i += 4) {
        const g = [sh[i], sh[i + 1], sh[i + 2], sh[i + 3]];
        const pat = r % 3;
        let A: string[], B: string[];
        if (pat === 0) { A = [g[0], g[1]]; B = [g[2], g[3]]; }
        else if (pat === 1) { A = [g[0], g[2]]; B = [g[1], g[3]]; }
        else { A = [g[0], g[3]]; B = [g[1], g[2]]; }
        M.push({ id: uid('m'), round: r + 1, aIds: A, bIds: B, aScore: 0, bScore: 0, done: false });
      }
    }
  }
  return M;
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
  return Object.values(st).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}
