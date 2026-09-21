/**
 * Testy uderzają w OSOBNĄ bazę (`padelparty_test`), żeby nie kasować lokalnego
 * deva przy każdym biegu. Vitest nie ładuje `.env` sam, a Prisma robi to dopiero
 * przy imporcie klienta — i nie nadpisuje zmiennych już ustawionych. Dlatego
 * czytamy `.env` tutaj, zanim cokolwiek zaimportuje Prismę.
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || !m[1]) continue;
    let value = (m[2] ?? '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}
