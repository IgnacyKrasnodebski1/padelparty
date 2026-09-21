/**
 * T014 — jednorazowe przeniesienie produkcyjnego bloba do tabel.
 *
 *   npm run migrate:kv -- --dry-run          # raport, zero zapisów
 *   npm run migrate:kv -- --file ../data.json --dry-run
 *   npm run migrate:kv                       # właściwa migracja
 *
 * Źródło domyślne to Supabase KV — te same zmienne, z których korzysta server.js
 * (SUPABASE_URL + SUPABASE_KEY, tabela `kv`, wiersz o id `padelparty`).
 * `--file` czyta lokalny zrzut i służy do prób na sucho bez sekretów produkcji.
 *
 * ZACHOWUJEMY STARE ID. `@default(cuid())` działa tylko wtedy, gdy `id` pominiemy,
 * więc podajemy je jawnie. To nie jest kosmetyka: aIds, bIds, memberIds, playerIds,
 * hostId, partyId i tournamentId to referencje po id. Przemapowanie oznaczałoby
 * przepisanie ich wszystkich, a każdy pominięty przypadek to cicho zepsute dane.
 *
 * Skrypt jest idempotentny (upsert po id) — przerwany bieg można powtórzyć.
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db';

const KV_KEY = 'padelparty';

interface LegacyUser {
  id?: string;
  username?: string;
  login?: string;
  passHash?: string;
  token?: string | null;
  playerId?: string;
}

interface LegacyPlayer {
  id?: string;
  name?: string;
  emoji?: string;
  color?: string;
}

interface LegacyGame {
  id?: string;
  ts?: number;
  mode?: string;
  partyId?: string | null;
  tournamentId?: string;
  aIds?: unknown;
  bIds?: unknown;
  aScore?: number;
  bScore?: number;
}

interface LegacyParty {
  id?: string;
  name?: string;
  code?: string;
  hostId?: string;
  mode?: string;
  memberIds?: unknown;
  status?: string;
  createdAt?: number;
}

interface LegacyTournament {
  id?: string;
  name?: string;
  mode?: string;
  scoring?: string;
  pointsTarget?: number;
  weekly?: boolean;
  rounds?: number;
  courts?: number;
  playerIds?: unknown;
  teams?: unknown;
  matches?: unknown;
  status?: string;
  createdAt?: number;
}

interface LegacyBlob {
  users?: LegacyUser[];
  data?: {
    players?: LegacyPlayer[];
    games?: LegacyGame[];
    parties?: LegacyParty[];
    tournaments?: LegacyTournament[];
  };
}

const strs = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];

const when = (ms: unknown): Date =>
  typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms) : new Date();

async function readBlob(fileArg: string | undefined): Promise<LegacyBlob> {
  if (fileArg) {
    const full = path.resolve(process.cwd(), fileArg);
    console.log(`Źródło: plik ${full}`);
    return JSON.parse(fs.readFileSync(full, 'utf8')) as LegacyBlob;
  }

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_KEY ?? '';
  if (!url || !key) {
    throw new Error(
      'Brak SUPABASE_URL / SUPABASE_KEY w env (albo użyj --file <ścieżka do zrzutu>).',
    );
  }

  console.log(`Źródło: Supabase KV (${url}, klucz ${KV_KEY})`);
  const res = await fetch(`${url}/rest/v1/kv?id=eq.${KV_KEY}&select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${text.slice(0, 200)}`);

  const rows = JSON.parse(text) as Array<{ data?: LegacyBlob }>;
  const blob = rows[0]?.data;
  if (!blob) throw new Error('Supabase zwróciło pusty wiersz — nie ma czego migrować.');
  return blob;
}

interface Report {
  players: number;
  accounts: number;
  games: number;
  parties: number;
  tournaments: number;
  gamePlayers: number;
  skipped: string[];
}

async function migrate(blob: LegacyBlob, dryRun: boolean): Promise<Report> {
  const players = blob.data?.players ?? [];
  const users = blob.users ?? [];
  const games = blob.data?.games ?? [];
  const parties = blob.data?.parties ?? [];
  const tournaments = blob.data?.tournaments ?? [];

  const knownPlayers = new Set(players.map((p) => p.id).filter((id): id is string => !!id));
  const report: Report = {
    players: 0,
    accounts: 0,
    games: 0,
    parties: 0,
    tournaments: 0,
    gamePlayers: 0,
    skipped: [],
  };

  // ── gracze ──────────────────────────────────────────────────────────────
  for (const p of players) {
    if (!p.id || !p.name) {
      report.skipped.push(`player bez id/name: ${JSON.stringify(p).slice(0, 80)}`);
      continue;
    }
    report.players += 1;
    if (dryRun) continue;
    await prisma.player.upsert({
      where: { id: p.id },
      update: { name: p.name, emoji: p.emoji ?? '🎾', color: p.color ?? '#6C5CE7' },
      create: {
        id: p.id,
        name: p.name,
        emoji: p.emoji ?? '🎾',
        color: p.color ?? '#6C5CE7',
      },
    });
  }

  // ── konta ───────────────────────────────────────────────────────────────
  for (const u of users) {
    // legacy trzymało to pod `username`; `login` obsługujemy na wypadek
    // późniejszych zrzutów z nowego backendu
    const login = u.login ?? u.username;
    if (!u.id || !login || !u.passHash || !u.playerId) {
      report.skipped.push(`account niekompletny: ${JSON.stringify({ id: u.id, login }).slice(0, 80)}`);
      continue;
    }
    if (!knownPlayers.has(u.playerId)) {
      report.skipped.push(`account ${login}: brak gracza ${u.playerId}`);
      continue;
    }
    report.accounts += 1;
    if (dryRun) continue;
    // passHash (scrypt salt_hex:hash_hex) przenosimy BEZ ZMIAN — to jedyny powód,
    // dla którego stare hasła dalej działają
    await prisma.account.upsert({
      where: { id: u.id },
      update: { login, passHash: u.passHash, token: u.token ?? null },
      create: {
        id: u.id,
        login,
        passHash: u.passHash,
        token: u.token ?? null,
        playerId: u.playerId,
      },
    });
  }

  // ── turnieje ────────────────────────────────────────────────────────────
  for (const t of tournaments) {
    if (!t.id) {
      report.skipped.push('tournament bez id');
      continue;
    }
    report.tournaments += 1;
    if (dryRun) continue;
    const data = {
      name: t.name ?? 'Turniej',
      mode: t.mode ?? 'americano',
      scoring: t.scoring === 'classic' ? 'classic' : 'points',
      pointsTarget: t.pointsTarget ?? 24,
      weekly: Boolean(t.weekly),
      rounds: t.rounds ?? 0,
      courts: t.courts ?? 1,
      playerIds: strs(t.playerIds),
      teams: (Array.isArray(t.teams) ? t.teams : []) as never,
      matches: (Array.isArray(t.matches) ? t.matches : []) as never,
      status: t.status ?? 'live',
      createdAt: when(t.createdAt),
    };
    await prisma.tournament.upsert({ where: { id: t.id }, update: data, create: { id: t.id, ...data } });
  }

  // ── party ───────────────────────────────────────────────────────────────
  for (const p of parties) {
    if (!p.id || !p.code) {
      report.skipped.push(`party bez id/code: ${JSON.stringify({ id: p.id }).slice(0, 60)}`);
      continue;
    }
    report.parties += 1;
    if (dryRun) continue;
    const data = {
      name: p.name ?? 'Party',
      code: p.code,
      hostId: p.hostId ?? '',
      mode: p.mode ?? 'americano',
      memberIds: strs(p.memberIds),
      status: p.status ?? 'open',
      createdAt: when(p.createdAt),
    };
    await prisma.partyGroup.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }

  // ── gierki + składy ─────────────────────────────────────────────────────
  for (const g of games) {
    if (!g.id) {
      report.skipped.push('game bez id');
      continue;
    }
    const aIds = strs(g.aIds).filter((id) => knownPlayers.has(id));
    const bIds = strs(g.bIds).filter((id) => knownPlayers.has(id));
    const dangling =
      strs(g.aIds).length - aIds.length + (strs(g.bIds).length - bIds.length);
    if (dangling > 0) {
      // legacy pozwalało zostawić wiszące id po usuniętym graczu; tabele
      // łączące mają FK, więc takie wpisy po prostu nie wejdą
      report.skipped.push(`game ${g.id}: ${dangling} wiszących id graczy pominięte`);
    }

    report.games += 1;
    report.gamePlayers += aIds.length + bIds.length;
    if (dryRun) continue;

    const data = {
      ts: when(g.ts),
      mode: g.mode ?? '',
      partyId: g.partyId ?? null,
      tournamentId: g.tournamentId ?? null,
      aScore: g.aScore ?? 0,
      bScore: g.bScore ?? 0,
    };
    await prisma.game.upsert({ where: { id: g.id }, update: data, create: { id: g.id, ...data } });

    // składy odtwarzamy od zera — upsert na kluczu złożonym byłby droższy
    await prisma.gamePlayerA.deleteMany({ where: { gameId: g.id } });
    await prisma.gamePlayerB.deleteMany({ where: { gameId: g.id } });
    if (aIds.length) {
      await prisma.gamePlayerA.createMany({ data: aIds.map((playerId) => ({ gameId: g.id!, playerId })) });
    }
    if (bIds.length) {
      await prisma.gamePlayerB.createMany({ data: bIds.map((playerId) => ({ gameId: g.id!, playerId })) });
    }
  }

  return report;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const fileIdx = argv.indexOf('--file');
  const file = fileIdx >= 0 ? argv[fileIdx + 1] : undefined;

  const blob = await readBlob(file);
  const report = await migrate(blob, dryRun);

  const inBlob = {
    players: blob.data?.players?.length ?? 0,
    accounts: blob.users?.length ?? 0,
    games: blob.data?.games?.length ?? 0,
    parties: blob.data?.parties?.length ?? 0,
    tournaments: blob.data?.tournaments?.length ?? 0,
  };

  console.log('');
  console.log(dryRun ? '── PRÓBA NA SUCHO (nic nie zapisano) ──' : '── MIGRACJA WYKONANA ──');
  console.log('encja          w blobie   ' + (dryRun ? 'do wstawienia' : 'wstawione'));
  const row = (label: string, a: number, b: number): void =>
    console.log(`${label.padEnd(15)}${String(a).padStart(8)}${String(b).padStart(14)}`);
  row('players', inBlob.players, report.players);
  row('accounts', inBlob.accounts, report.accounts);
  row('games', inBlob.games, report.games);
  row('parties', inBlob.parties, report.parties);
  row('tournaments', inBlob.tournaments, report.tournaments);
  console.log(`${'składy (A+B)'.padEnd(15)}${'—'.padStart(8)}${String(report.gamePlayers).padStart(14)}`);

  if (report.skipped.length) {
    console.log('');
    console.log(`Pominięte (${report.skipped.length}):`);
    for (const s of report.skipped.slice(0, 25)) console.log('  - ' + s);
    if (report.skipped.length > 25) console.log(`  … i ${report.skipped.length - 25} więcej`);
  }

  if (!dryRun) {
    console.log('');
    console.log('W bazie po migracji:');
    console.log(`  players      ${await prisma.player.count()}`);
    console.log(`  accounts     ${await prisma.account.count()}`);
    console.log(`  games        ${await prisma.game.count()}`);
    console.log(`  parties      ${await prisma.partyGroup.count()}`);
    console.log(`  tournaments  ${await prisma.tournament.count()}`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
