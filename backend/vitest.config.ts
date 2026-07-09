import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // testy wymagające bazy oznaczamy describe.skipIf(!process.env.DATABASE_URL)
  },
});
