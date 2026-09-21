import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface LegacyServer {
  url: string;
  stop: () => void;
}

/**
 * Uruchamia STARY server.js obok testów, żeby porównać go z nowym backendem.
 *
 * Dwie rzeczy są tu istotne dla bezpieczeństwa:
 *  - server.js zapisuje `data.json` obok SIEBIE (`path.join(__dirname, 'data.json')`),
 *    nie w cwd. Dlatego kopiujemy go do katalogu tymczasowego — inaczej test
 *    nadpisywałby lokalny plik deweloperski w korzeniu repo.
 *  - czyścimy env ze zmiennych SUPABASE i UPSTASH, żeby legacy NIE dotknęło produkcyjnego
 *    bloba, tylko spadło na plikowy fallback.
 */
export async function startLegacyServer(): Promise<LegacyServer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'padelparty-legacy-'));
  const source = path.resolve(__dirname, '..', '..', '..', 'server.js');
  fs.copyFileSync(source, path.join(dir, 'server.js'));

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_KEY;
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;

  const port = 9100 + Math.floor(Math.random() * 700);
  env.PORT = String(port);

  const child: ChildProcess = spawn(process.execPath, ['server.js'], {
    cwd: dir,
    env,
    stdio: 'ignore',
  });

  const url = `http://127.0.0.1:${port}`;

  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${url}/healthz`);
      if (r.ok) break;
    } catch {
      /* jeszcze nie wstał */
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  return {
    url,
    stop: () => {
      child.kill();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
