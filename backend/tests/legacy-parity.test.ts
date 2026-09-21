/**
 * T019 — dowód, że nowy backend odpowiada tak samo jak stary server.js.
 *
 * Metoda: ten sam scenariusz leci na oba backendy (legacy w osobnym procesie,
 * nowy przez supertest), odpowiedzi są normalizowane (id/tokeny/czasy/kody) i
 * porównywane po kolei.
 *
 * ŚWIADOME RÓŻNICE, uwzględnione w `LEGACY_MESSAGE_MAP` i w osobnych testach
 * na końcu pliku:
 *  1. pole logowania to `login`, nie `username` (decyzja: kontrakt wygrywa),
 *     a komunikaty mówią „login" zamiast „ksywa",
 *  2. `delPlayer` wypisuje gracza ze składów rozegranych gierek zamiast
 *     zostawiać wiszące id (klucze obce),
 *  3. kolejność tablicy `games` (patrz sortGames w helpers/normalize.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { startLegacyServer, type LegacyServer } from './helpers/legacyServer';
import { createNormalizer, sortGames } from './helpers/normalize';

type Method = 'GET' | 'POST';
type Json = Record<string, any>;
interface Res {
  status: number;
  body: Json;
}
type Call = (method: Method, path: string, body?: unknown, token?: string | null) => Promise<Res>;
interface Step {
  label: string;
  status: number;
  body: unknown;
}

/** Komunikaty, które celowo różnią się terminologią — legacy → oczekiwane dziś. */
const LEGACY_MESSAGE_MAP: Record<string, string> = {
  'Ksywa min. 2 znaki': 'Login min. 2 znaki',
  'Ta ksywa jest zajęta': 'Ten login jest zajęty',
  'Zła ksywa lub hasło': 'Zły login lub hasło',
};

function translateLegacy(body: Json): Json {
  if (typeof body.error === 'string' && LEGACY_MESSAGE_MAP[body.error]) {
    return { ...body, error: LEGACY_MESSAGE_MAP[body.error] };
  }
  return body;
}

/** Scenariusz wykonywany identycznie na obu backendach. */
async function scenario(call: Call, credField: 'username' | 'login'): Promise<Step[]> {
  const steps: Step[] = [];
  const push = (label: string, r: Res): Res => {
    steps.push({ label, status: r.status, body: r.body });
    return r;
  };

  const creds = (loginValue: string, password: string, extra: Json = {}): Json => ({
    [credField]: loginValue,
    password,
    ...extra,
  });

  // ── auth ────────────────────────────────────────────────────────────────
  const reg = push(
    'register',
    await call('POST', '/api/register', creds('Kuba', 'tajne', { emoji: '🦁', color: '#FF9F1A' })),
  );
  const token = reg.body.token as string;
  const meId = reg.body.meId as string;

  push('register:krótki login', await call('POST', '/api/register', creds('K', 'tajne')));
  push('register:krótkie hasło', await call('POST', '/api/register', creds('Ola', 'ab')));
  push('register:duplikat', await call('POST', '/api/register', creds('Kuba', 'inne')));
  push('login:złe hasło', await call('POST', '/api/login', creds('Kuba', 'nie-to')));
  push('login:nieznany', await call('POST', '/api/login', creds('nikt', 'tajne')));
  push('login:ok', await call('POST', '/api/login', creds('KUBA', 'tajne')));

  // token z rejestracji przestał działać (login rotuje token) — sprawdzamy to
  // jawnie, bo od tego zależy, czy „wyloguj wszędzie" faktycznie działa
  push('state:stary token po rotacji', await call('GET', '/api/state', undefined, token));

  const relog = await call('POST', '/api/login', creds('Kuba', 'tajne'));
  const live = relog.body.token as string;

  push('state:bez tokenu', await call('GET', '/api/state'));
  push('state:zły token', await call('GET', '/api/state', undefined, 'nie-ma-takiego'));
  push('nieznana ścieżka', await call('GET', '/api/nie-ma', undefined, live));
  push('mutate:nieznany typ', await call('POST', '/api/mutate', { type: 'nic-takiego' }, live));

  // ── mutacje ─────────────────────────────────────────────────────────────
  push(
    'addPlayer:obcięcie do 16',
    await call('POST', '/api/mutate', { type: 'addPlayer', payload: { name: 'Bardzo Długie Imię Gracza' } }, live),
  );
  const defaults = push(
    'addPlayer:domyślne',
    await call('POST', '/api/mutate', { type: 'addPlayer', payload: {} }, live),
  );
  const players = defaults.body.data.players as Array<{ id: string; name: string }>;
  const rywal = players[1]!.id;
  const doUsuniecia = players[2]!.id;

  push(
    'addGame',
    await call(
      'POST',
      '/api/mutate',
      { type: 'addGame', payload: { mode: 'americano', aIds: [meId], bIds: [rywal], aScore: 21, bScore: 12 } },
      live,
    ),
  );

  const party = push(
    'addParty:domyślne',
    await call('POST', '/api/mutate', { type: 'addParty', payload: {} }, live),
  );
  const code = (party.body.data.parties as Array<{ code: string; id: string }>)[0]!.code;
  const partyId = (party.body.data.parties as Array<{ code: string; id: string }>)[0]!.id;

  push('joinParty:zły kod', await call('POST', '/api/mutate', { type: 'joinParty', payload: { code: 'ZZZZZ' } }, live));
  push(
    'updateParty:zamknięcie',
    await call('POST', '/api/mutate', { type: 'updateParty', payload: { id: partyId, status: 'done' } }, live),
  );
  push(
    'joinParty:wznawia zamknięte',
    await call('POST', '/api/mutate', { type: 'joinParty', payload: { code: code.toLowerCase() } }, live),
  );
  push(
    'updateParty:nieistniejące id',
    await call('POST', '/api/mutate', { type: 'updateParty', payload: { id: 'ptdeadbeef00', status: 'done' } }, live),
  );

  const tour = push(
    'addTournament:rounds 0 → 6',
    await call(
      'POST',
      '/api/mutate',
      {
        type: 'addTournament',
        payload: {
          name: 'Turniej o bardzo długiej nazwie ponad limit',
          scoring: 'classic',
          rounds: 0,
          courts: 0,
          pointsTarget: 0,
          playerIds: [meId, rywal],
        },
      },
      live,
    ),
  );
  const tourId = (tour.body.data.tournaments as Array<{ id: string }>)[0]!.id;

  push(
    'updateTournament:sync gier',
    await call(
      'POST',
      '/api/mutate',
      {
        type: 'updateTournament',
        payload: {
          id: tourId,
          matches: [
            { id: 'm1', round: 1, aIds: [meId], bIds: [rywal], aScore: 6, bScore: 3, done: true },
            { id: 'm2', round: 1, aIds: [meId], bIds: [rywal], aScore: 4, bScore: 4, done: true },
            { id: 'm3', round: 2, aIds: [meId], bIds: [rywal], aScore: 0, bScore: 0, done: false },
          ],
        },
      },
      live,
    ),
  );
  push(
    'updateTournament:nieistniejące id',
    await call('POST', '/api/mutate', { type: 'updateTournament', payload: { id: 'tdeadbeef000' } }, live),
  );

  push(
    'delPlayer:gracz z kontem',
    await call('POST', '/api/mutate', { type: 'delPlayer', payload: { id: meId } }, live),
  );
  push(
    'delPlayer:gracz bez gierek',
    await call('POST', '/api/mutate', { type: 'delPlayer', payload: { id: doUsuniecia } }, live),
  );

  push('state', await call('GET', '/api/state', undefined, live));
  push('reset', await call('POST', '/api/mutate', { type: 'reset' }, live));
  push('logout', await call('POST', '/api/logout', undefined, live));
  push('state:po wylogowaniu', await call('GET', '/api/state', undefined, live));

  return steps;
}

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('legacy parity: server.js ↔ backend/', () => {
  let legacy: LegacyServer;

  beforeAll(async () => {
    legacy = await startLegacyServer();
    await resetDb();
  });

  afterAll(async () => {
    legacy.stop();
    await prisma.$disconnect();
  });

  it('odpowiada identycznie na pełnym scenariuszu', async () => {
    const legacyCall: Call = async (method, path, body, token) => {
      const res = await fetch(legacy.url + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      });
      return { status: res.status, body: (await res.json()) as Json };
    };

    const newCall: Call = async (method, path, body, token) => {
      const req = method === 'GET' ? request(app).get(path) : request(app).post(path);
      if (token) req.set('Authorization', `Bearer ${token}`);
      const res = await (method === 'POST' ? req.send(body ?? {}) : req);
      return { status: res.status, body: res.body as Json };
    };

    const legacySteps = await scenario(legacyCall, 'username');
    const newSteps = await scenario(newCall, 'login');

    expect(newSteps).toHaveLength(legacySteps.length);

    const normLegacy = createNormalizer();
    const normNew = createNormalizer();

    for (let i = 0; i < legacySteps.length; i++) {
      const l = legacySteps[i]!;
      const n = newSteps[i]!;

      expect(n.label, `krok ${i}`).toBe(l.label);
      expect(n.status, `status kroku „${l.label}"`).toBe(l.status);

      // sortujemy PO normalizacji — surowe id są losowe, więc sortowanie przed
      // nią ustawiałoby obie strony w różnej kolejności
      const expected = sortGames(normLegacy(translateLegacy(l.body as Json)));
      const actual = sortGames(normNew(n.body as Json));

      expect(actual, `treść kroku „${l.label}"`).toEqual(expected);
    }
  });
});

describe.skipIf(!hasDb)('udokumentowane odstępstwa od legacy', () => {
  // każdy z tych testów liczy rekordy od zera — czyścimy przed każdym, nie raz na blok
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('delPlayer wypisuje gracza ze składów zamiast zostawiać wiszące id', async () => {
    const reg = await request(app).post('/api/register').send({ login: 'anna', password: 'tajne' });
    const token = reg.body.token as string;
    const meId = reg.body.meId as string;

    const added = await request(app)
      .post('/api/mutate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'addPlayer', payload: { name: 'Rywal' } });
    const rywal = (added.body.data.players as Array<{ id: string }>)[1]!.id;

    await request(app)
      .post('/api/mutate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'addGame', payload: { mode: 'americano', aIds: [meId], bIds: [rywal], aScore: 21, bScore: 9 } });

    const after = await request(app)
      .post('/api/mutate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'delPlayer', payload: { id: rywal } });

    expect(after.status).toBe(200);
    const games = after.body.data.games as Array<{ aIds: string[]; bIds: string[] }>;
    expect(games).toHaveLength(1);
    // gierka zostaje w historii, ale bez usuniętego zawodnika
    expect(games[0]!.aIds).toEqual([meId]);
    expect(games[0]!.bIds).toEqual([]);
  });

  it('seedDemo dokłada 7 graczy demo i 24 gierki', async () => {
    const reg = await request(app).post('/api/register').send({ login: 'basia', password: 'tajne' });
    const token = reg.body.token as string;

    const r = await request(app)
      .post('/api/mutate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'seedDemo' });

    const data = r.body.data as { players: Array<{ name: string }>; games: unknown[] };
    expect(data.games).toHaveLength(24);
    for (const name of ['Kuba', 'Ola', 'Michał', 'Zosia', 'Bartek', 'Ewa', 'Piotr']) {
      expect(data.players.some((p) => p.name === name), `brakuje gracza ${name}`).toBe(true);
    }
  });
});

async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Account","Player","Game","GamePlayerA","GamePlayerB","PartyGroup","Tournament" RESTART IDENTITY CASCADE',
  );
}
