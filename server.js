/* PadelParty — pure Node server: static frontend + accounts API + JSON persistence. Zero dependencies. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8099;
const DB_FILE = path.join(ROOT, 'data.json');

/* ---------- storage ----------
   Trwałość (zero zależności, czysty fetch). Wybór wg env vars:
   1) SUPABASE_URL + SUPABASE_KEY → tabela public.kv (id text pk, data jsonb)  [PREFEROWANE]
   2) UPSTASH_REDIS_REST_URL + _TOKEN → Upstash Redis
   3) brak → lokalny plik data.json (ULOTNY na darmowym Renderze).
   Cały obiekt DB ({users, data}) trzymany jako jeden wiersz/klucz o id 'padelparty'. */
const KV_KEY = 'padelparty';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_KEY || '';
const SB_ON = !!(SB_URL && SB_KEY);
const UP_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const UP_TOK = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const UP_ON = !!(UP_URL && UP_TOK);
const STORE = SB_ON ? 'Supabase (trwałe)' : UP_ON ? 'Upstash (trwałe)' : 'plik (ulotny)';
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
let DB = { users: [], data: { players: [], games: [], parties: [], tournaments: [] } };

async function loadDB() {
  try {
    if (SB_ON) {
      const r = await fetch(`${SB_URL}/rest/v1/kv?id=eq.${KV_KEY}&select=data`, { headers: sbHeaders });
      const j = await r.json();
      if (Array.isArray(j) && j[0] && j[0].data) { DB = j[0].data; console.log('DB z Supabase'); return; }
      if (!Array.isArray(j)) console.error('Supabase load:', JSON.stringify(j).slice(0, 200));
      else console.log('Supabase puste — świeża baza');
      return;
    }
    if (UP_ON) {
      const r = await fetch(`${UP_URL}/get/${KV_KEY}`, { headers: { Authorization: `Bearer ${UP_TOK}` } });
      const j = await r.json();
      if (j && j.result) { DB = JSON.parse(j.result); console.log('DB z Upstash'); return; }
      console.log('Upstash puste — świeża baza'); return;
    }
  } catch (e) { console.error('load error, fallback plik:', e.message); }
  try { DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { /* fresh */ }
}
let fileTimer = null, saving = false, dirty = false;
function persist() {
  clearTimeout(fileTimer);
  fileTimer = setTimeout(() => { try { fs.writeFileSync(DB_FILE, JSON.stringify(DB)); } catch (e) {} }, 50);
  if (SB_ON || UP_ON) saveRemote();
}
async function saveRemote() {
  dirty = true; if (saving) return; saving = true;
  while (dirty) {
    dirty = false;
    try {
      if (SB_ON) {
        await fetch(`${SB_URL}/rest/v1/kv`, { method: 'POST', headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: KV_KEY, data: DB }) });
      } else {
        await fetch(`${UP_URL}/set/${KV_KEY}`, { method: 'POST', headers: { Authorization: `Bearer ${UP_TOK}` }, body: JSON.stringify(DB) });
      }
    } catch (e) { console.error('remote save error:', e.message); }
  }
  saving = false;
}
const uid = p => (p || 'id') + crypto.randomBytes(5).toString('hex');

/* ---------- auth ---------- */
function hashPw(pw) { const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(pw, salt, 64).toString('hex'); return salt + ':' + h; }
function verifyPw(pw, stored) {
  try { const [salt, h] = stored.split(':'); const h2 = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(h2, 'hex')); } catch (e) { return false; }
}
function userByToken(tok) { return tok ? DB.users.find(u => u.token === tok) : null; }

/* ---------- domain helpers ---------- */
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function syncTourGames(t) {
  const d = DB.data;
  d.games = d.games.filter(g => g.tournamentId !== t.id);
  let i = 0;
  const gmode = t.scoring === 'classic' ? 'klasyk' : 'americano';
  t.matches.filter(m => m.done && m.aScore !== m.bScore).forEach(m => {
    d.games.push({ id: uid('g'), ts: t.createdAt + (++i), mode: gmode, tournamentId: t.id, partyId: null, aIds: m.aIds, bIds: m.bIds, aScore: m.aScore, bScore: m.bScore });
  });
}
function shortCode() { let c = ''; const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; for (let i = 0; i < 5; i++) c += A[crypto.randomInt(A.length)]; return c; }
function seedDemo() {
  const d = DB.data;
  const demo = [['Kuba', '🦁', '#FF9F1A'], ['Ola', '🦊', '#FF4D8D'], ['Michał', '🦈', '#2D6CFF'], ['Zosia', '⚡', '#12B886'], ['Bartek', '🐉', '#6C5CE7'], ['Ewa', '👑', '#FF5A5F'], ['Piotr', '🚀', '#66D01A']];
  demo.forEach(([n, e, c]) => { if (!d.players.some(p => p.name === n)) d.players.push({ id: uid('p'), name: n, emoji: e, color: c }); });
  const pool = d.players.map(p => p.id);
  for (let i = 0; i < 24; i++) {
    const sh = [...pool].sort(() => Math.random() - .5);
    const dbl = Math.random() > .4 && pool.length >= 4;
    const A = dbl ? [sh[0], sh[1]] : [sh[0]], B = dbl ? [sh[2], sh[3]] : [sh[1]];
    const amer = Math.random() > .35; let sa, sb;
    if (amer) { if (Math.random() > .5) { sa = 21; sb = crypto.randomInt(20); } else { sb = 21; sa = crypto.randomInt(20); } }
    else { if (Math.random() > .5) { sa = 6; sb = crypto.randomInt(6); } else { sb = 6; sa = crypto.randomInt(6); } }
    d.games.push({ id: uid('g'), ts: Date.now() - (24 - i) * 3600000, mode: amer ? 'americano' : 'klasyk', partyId: null, aIds: A, bIds: B, aScore: sa, bScore: sb });
  }
}

/* ---------- mutations (require auth) ---------- */
function applyMutation(user, type, payload) {
  const d = DB.data;
  const p = payload || {};
  switch (type) {
    case 'addPlayer': d.players.push({ id: uid('p'), name: (p.name || 'Gracz').slice(0, 16), emoji: p.emoji || '🎾', color: p.color || '#6C5CE7' }); break;
    case 'delPlayer': {
      if (DB.users.some(u => u.playerId === p.id)) throw new Error('Nie można usunąć gracza z kontem');
      d.players = d.players.filter(x => x.id !== p.id); break;
    }
    case 'addGame': d.games.push({ id: uid('g'), ts: Date.now(), mode: p.mode, partyId: p.partyId || null, aIds: p.aIds, bIds: p.bIds, aScore: p.aScore, bScore: p.bScore }); break;
    case 'addParty': d.parties.push({ id: uid('pt'), name: (p.name || 'Party').slice(0, 24), code: shortCode(), hostId: user.playerId, mode: p.mode || 'americano', memberIds: p.memberIds || [user.playerId], status: 'open', createdAt: Date.now() }); break;
    case 'joinParty': {
      const party = d.parties.find(x => x.code === (p.code || '').toUpperCase());
      if (!party) throw new Error('Nie znaleziono kodu');
      if (!party.memberIds.includes(user.playerId)) party.memberIds.push(user.playerId);
      party.status = 'open'; break;
    }
    case 'updateParty': {
      const party = d.parties.find(x => x.id === p.id); if (!party) break;
      if (p.memberIds) party.memberIds = p.memberIds;
      if (p.status) party.status = p.status;
      if (p.mode) party.mode = p.mode;
      break;
    }
    case 'addTournament': {
      const t = {
        id: uid('t'), name: (p.name || 'Turniej').slice(0, 30), status: 'live', createdAt: Date.now(),
        mode: p.mode || 'americano', scoring: p.scoring === 'classic' ? 'classic' : 'points', pointsTarget: p.pointsTarget || 24,
        weekly: !!p.weekly, rounds: p.rounds || 6,
        playerIds: p.playerIds || [], teams: p.teams || [], matches: p.matches || [],
      };
      d.tournaments.push(t); break;
    }
    case 'updateTournament': {
      const t = d.tournaments.find(x => x.id === p.id); if (!t) break;
      if (p.matches) t.matches = p.matches;
      if (p.status) t.status = p.status;
      syncTourGames(t); break;
    }
    case 'seedDemo': seedDemo(); break;
    case 'reset': d.games = []; d.parties = []; d.tournaments = []; break;
    default: throw new Error('Nieznana operacja');
  }
  persist();
}

/* ---------- http helpers ---------- */
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise(r => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(s ? JSON.parse(s) : {}); } catch (e) { r({}); } }); }); }
function serveStatic(req, res) {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'OPTIONS') return send(res, 200, {});
  if (url === '/healthz') return send(res, 200, { ok: true });
  if (!url.startsWith('/api/')) return serveStatic(req, res);

  try {
    if (url === '/api/register' && req.method === 'POST') {
      const b = await body(req);
      const username = (b.username || '').trim().toLowerCase();
      if (username.length < 2) return send(res, 400, { error: 'Ksywa min. 2 znaki' });
      if (!b.password || b.password.length < 3) return send(res, 400, { error: 'Hasło min. 3 znaki' });
      if (DB.users.some(u => u.username === username)) return send(res, 409, { error: 'Ta ksywa jest zajęta' });
      const player = { id: uid('p'), name: (b.name || b.username).slice(0, 16), emoji: b.emoji || '🎾', color: b.color || '#6C5CE7' };
      DB.data.players.push(player);
      const token = crypto.randomBytes(24).toString('hex');
      DB.users.push({ id: uid('u'), username, passHash: hashPw(b.password), token, playerId: player.id });
      persist();
      return send(res, 200, { token, meId: player.id, data: DB.data });
    }
    if (url === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      const username = (b.username || '').trim().toLowerCase();
      const user = DB.users.find(u => u.username === username);
      if (!user || !verifyPw(b.password || '', user.passHash)) return send(res, 401, { error: 'Zła ksywa lub hasło' });
      user.token = crypto.randomBytes(24).toString('hex'); persist();
      return send(res, 200, { token: user.token, meId: user.playerId, data: DB.data });
    }

    // authenticated routes
    const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
    const user = userByToken(tok);
    if (!user) return send(res, 401, { error: 'unauth' });

    if (url === '/api/state' && req.method === 'GET') return send(res, 200, { meId: user.playerId, data: DB.data });
    if (url === '/api/mutate' && req.method === 'POST') {
      const b = await body(req);
      try { applyMutation(user, b.type, b.payload); } catch (e) { return send(res, 400, { error: e.message }); }
      return send(res, 200, { meId: user.playerId, data: DB.data });
    }
    if (url === '/api/logout' && req.method === 'POST') { user.token = null; persist(); return send(res, 200, {}); }
    return send(res, 404, { error: 'not found' });
  } catch (e) { console.error(e); return send(res, 500, { error: 'server error' }); }
});

loadDB().then(() => {
  server.listen(PORT, () => console.log(`PadelParty on http://localhost:${PORT} (storage: ${STORE})`));
});
