/**
 * T017 — onboarding i logowanie menedżera klubu (scenariusz A z quickstart.md),
 * razem z negatywem: konto bez ukończonego TOTP nie dostaje sesji.
 */
import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { generateSync } from 'otplib';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { rateLimit } from '../src/middleware/rateLimit';

const hasDb = Boolean(process.env.DATABASE_URL);

const SILNE_HASLO = 'rakieta-lipiec-truskawka-92';
const EMAIL = 'menedzer@padelparty.test';

async function zaproszenie(): Promise<{ inviteToken: string; clubId: string }> {
  const inviteToken = randomBytes(24).toString('hex');
  const club = await prisma.club.create({
    data: { slug: 'klub-testowy-' + randomBytes(3).toString('hex'), name: 'Klub Testowy' },
  });
  const manager = await prisma.managerAccount.create({ data: { email: EMAIL, inviteToken } });
  await prisma.managerMembership.create({
    data: { managerId: manager.id, clubId: club.id, role: 'owner' },
  });
  return { inviteToken, clubId: club.id };
}

/** Pełne przejście onboardingu — zwraca sekret TOTP, kody zapasowe i sesję. */
async function onboard(inviteToken: string): Promise<{
  secret: string;
  backupCodes: string[];
  token: string;
}> {
  const accept = await request(app)
    .post('/api/mgr/accept-invite')
    .send({ inviteToken, email: EMAIL, password: SILNE_HASLO });
  expect(accept.status).toBe(200);

  const setupToken = accept.body.setupToken as string;

  const setup = await request(app)
    .post('/api/mgr/totp/setup')
    .set('Authorization', `Bearer ${setupToken}`)
    .send({});
  expect(setup.status).toBe(200);

  const secret = new URL(setup.body.otpauthUrl as string).searchParams.get('secret');
  expect(secret).toBeTruthy();

  const verify = await request(app)
    .post('/api/mgr/totp/verify')
    .set('Authorization', `Bearer ${setupToken}`)
    .send({ code: generateSync({ secret: secret! }) });
  expect(verify.status).toBe(200);

  return {
    secret: secret!,
    backupCodes: setup.body.backupCodes as string[],
    token: verify.body.token as string,
  };
}

describe.skipIf(!hasDb)('auth menedżera (2FA obowiązkowe)', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ManagerMembership","ManagerAccount","Club" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(() => prisma.$disconnect());

  it('odrzuca słabe hasło', async () => {
    const { inviteToken } = await zaproszenie();
    const r = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: EMAIL, password: 'padel2024' });

    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/za słabe/i);
  });

  it('nie zdradza, które zaproszenie istnieje', async () => {
    const { inviteToken } = await zaproszenie();

    const zlyToken = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken: 'nie-ma-takiego', email: EMAIL, password: SILNE_HASLO });
    const zlyEmail = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: 'ktos@inny.pl', password: SILNE_HASLO });

    expect(zlyToken.status).toBe(400);
    expect(zlyEmail.status).toBe(400);
    expect(zlyEmail.body.error).toBe(zlyToken.body.error);
  });

  it('zużywa zaproszenie — drugi raz już nie działa', async () => {
    const { inviteToken } = await zaproszenie();

    const pierwszy = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: EMAIL, password: SILNE_HASLO });
    const drugi = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: EMAIL, password: SILNE_HASLO });

    expect(pierwszy.status).toBe(200);
    expect(drugi.status).toBe(400);
  });

  it('konto z hasłem, ale bez TOTP, dostaje 401 MFA_REQUIRED', async () => {
    const { inviteToken } = await zaproszenie();
    await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: EMAIL, password: SILNE_HASLO });

    const r = await request(app).post('/api/mgr/login').send({ email: EMAIL, password: SILNE_HASLO });

    expect(r.status).toBe(401);
    expect(r.body.error).toBe('MFA_REQUIRED');
  });

  it('przechodzi pełny onboarding i wpuszcza na sesję', async () => {
    const { inviteToken, clubId } = await zaproszenie();
    const { token } = await onboard(inviteToken);

    const me = await request(app).get('/api/mgr/me').set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.email).toBe(EMAIL);
    expect(me.body.clubs).toHaveLength(1);
    expect(me.body.clubs[0].id).toBe(clubId);
    expect(me.body.clubs[0].role).toBe('owner');
  });

  it('setup daje 10 kodów zapasowych, a w bazie leżą tylko ich hashe', async () => {
    const { inviteToken } = await zaproszenie();
    const { backupCodes } = await onboard(inviteToken);

    expect(backupCodes).toHaveLength(10);

    const manager = await prisma.managerAccount.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(manager.backupCodes).toHaveLength(10);
    for (const jawny of backupCodes) {
      expect(manager.backupCodes).not.toContain(jawny);
    }
  });

  it('odrzuca zły kod przy konfiguracji', async () => {
    const { inviteToken } = await zaproszenie();
    const accept = await request(app)
      .post('/api/mgr/accept-invite')
      .send({ inviteToken, email: EMAIL, password: SILNE_HASLO });
    const setupToken = accept.body.setupToken as string;

    await request(app)
      .post('/api/mgr/totp/setup')
      .set('Authorization', `Bearer ${setupToken}`)
      .send({});

    const r = await request(app)
      .post('/api/mgr/totp/verify')
      .set('Authorization', `Bearer ${setupToken}`)
      .send({ code: '000000' });

    expect(r.status).toBe(401);
  });

  it('loguje dwukrokowo: hasło → mfaToken → kod → sesja', async () => {
    const { inviteToken } = await zaproszenie();
    const { secret } = await onboard(inviteToken);

    const krok1 = await request(app)
      .post('/api/mgr/login')
      .send({ email: EMAIL, password: SILNE_HASLO });
    expect(krok1.status).toBe(200);
    expect(krok1.body.mfaToken).toBeTruthy();
    expect(krok1.body.token).toBeUndefined();

    // mfaToken NIE jest sesją — to jest cały sens rozdzielenia tokenów
    const podszycie = await request(app)
      .get('/api/mgr/me')
      .set('Authorization', `Bearer ${krok1.body.mfaToken}`);
    expect(podszycie.status).toBe(401);

    const krok2 = await request(app)
      .post('/api/mgr/login/totp')
      .send({ mfaToken: krok1.body.mfaToken, code: generateSync({ secret }) });
    expect(krok2.status).toBe(200);

    const me = await request(app)
      .get('/api/mgr/me')
      .set('Authorization', `Bearer ${krok2.body.token}`);
    expect(me.status).toBe(200);
  });

  it('kod zapasowy działa raz i znika z puli', async () => {
    const { inviteToken } = await zaproszenie();
    const { backupCodes } = await onboard(inviteToken);
    const kod = backupCodes[0]!;

    const login = async () =>
      (await request(app).post('/api/mgr/login').send({ email: EMAIL, password: SILNE_HASLO })).body
        .mfaToken as string;

    const pierwszy = await request(app)
      .post('/api/mgr/login/totp')
      .send({ mfaToken: await login(), backupCode: kod.toLowerCase() });
    expect(pierwszy.status).toBe(200);

    const drugi = await request(app)
      .post('/api/mgr/login/totp')
      .send({ mfaToken: await login(), backupCode: kod });
    expect(drugi.status).toBe(401);

    const manager = await prisma.managerAccount.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(manager.backupCodes).toHaveLength(9);
  });

  it('odrzuca złe hasło tym samym komunikatem co nieznany e-mail', async () => {
    const { inviteToken } = await zaproszenie();
    await onboard(inviteToken);

    const zleHaslo = await request(app)
      .post('/api/mgr/login')
      .send({ email: EMAIL, password: 'zupelnie-inne-haslo-123' });
    const nieznany = await request(app)
      .post('/api/mgr/login')
      .send({ email: 'nikt@padelparty.test', password: SILNE_HASLO });

    expect(zleHaslo.status).toBe(401);
    expect(nieznany.status).toBe(401);
    expect(zleHaslo.body.error).toBe(nieznany.body.error);
  });
});

describe('rateLimit (mechanizm)', () => {
  it('przepuszcza do limitu, potem 429', async () => {
    const poprzednia = process.env.RATE_LIMIT_OFF;
    delete process.env.RATE_LIMIT_OFF;

    try {
      const limiter = rateLimit({ windowMs: 60_000, max: 3 });
      const req = { ip: '10.0.0.1', body: {} } as never;
      const wyniki: Array<number | null> = [];

      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => {
          limiter(req, {} as never, ((err?: { status?: number }) => {
            wyniki.push(err?.status ?? null);
            resolve();
          }) as never);
        });
      }

      expect(wyniki).toEqual([null, null, null, 429, 429]);
    } finally {
      if (poprzednia !== undefined) process.env.RATE_LIMIT_OFF = poprzednia;
    }
  });
});
