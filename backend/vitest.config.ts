import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // setup przestawia DATABASE_URL na bazę testową, ZANIM cokolwiek zaimportuje Prismę
    setupFiles: ['tests/setup.ts'],
    // testy parity uruchamiają obok siebie stary server.js — bez izolacji procesów
    // równoległe pliki biłyby się o tę samą bazę
    fileParallelism: false,
    testTimeout: 30_000,
    // testy wymagające bazy oznaczamy `describe.skipIf(!process.env.DATABASE_URL)`
  },
});
