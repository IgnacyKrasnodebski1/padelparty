import type { RequestHandler } from 'express';
import { prisma } from '../db';

interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
}

/**
 * Sonda dla keep-warma (.github/workflows/keep-warm.yml) i pierwsza rzecz, którą
 * sprawdza się po deployu. Legacy zwracał `{ok, storage, sb?, users}` — tutaj
 * `storage` to "postgres", a zamiast diagnostyki Supabase KV leci stan migracji.
 *
 * Endpoint nie może rzucać: gdy baza leży, ma odpowiedzieć 503 z powodem,
 * a nie przewrócić się w errorHandlerze.
 */
export const healthz: RequestHandler = async (_req, res) => {
  try {
    const [users, migrations] = await Promise.all([
      prisma.account.count(),
      prisma.$queryRaw<MigrationRow[]>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 1
      `,
    ]);

    const last = migrations[0];

    res.json({
      ok: true,
      service: 'padelparty-backend',
      storage: 'postgres',
      migration: last ? last.migration_name : null,
      migrationPending: last ? last.finished_at === null : null,
      users,
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      service: 'padelparty-backend',
      storage: 'postgres',
      error: err instanceof Error ? err.message : 'db unreachable',
    });
  }
};
