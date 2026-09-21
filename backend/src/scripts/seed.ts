/**
 * Seed deweloperski wg quickstart.md: klub „Padel Warszawa Test" (status invited),
 * zaproszenie menedżera, 2 korty, godziny 7–23, cennik 90 min.
 *
 *   npm run seed
 *
 * Idempotentny — można puszczać wielokrotnie. Klub i konto menedżera idą przez
 * upsert po naturalnych kluczach (slug / email); korty, godziny i cennik nie mają
 * naturalnego unique, więc są odtwarzane od zera dla tego jednego klubu.
 */
import { randomBytes } from 'node:crypto';
import { prisma } from '../db';

const CLUB_SLUG = 'padel-warszawa-test';
const MANAGER_EMAIL = 'menedzer@padelparty.test';
const PRICE_GR = 12_000; // 120 zł za 90 min — kwoty zawsze w groszach (int)

async function main(): Promise<void> {
  const club = await prisma.club.upsert({
    where: { slug: CLUB_SLUG },
    update: {},
    create: {
      slug: CLUB_SLUG,
      name: 'Padel Warszawa Test',
      description: 'Klub testowy do developmentu — nie jest prawdziwym obiektem.',
      city: 'Warszawa',
      address: 'ul. Testowa 1',
      lat: 52.2297,
      lng: 21.0122,
      // invited = klub zaproszony, ale menedżer jeszcze nie przeszedł onboardingu (T017).
      status: 'invited',
    },
  });

  // Zaproszenie menedżera: konto bez hasła i bez TOTP — dokładnie taki stan,
  // od którego zaczyna accept-invite w T017.
  const existingManager = await prisma.managerAccount.findUnique({
    where: { email: MANAGER_EMAIL },
    select: { id: true, inviteToken: true },
  });
  const inviteToken = existingManager?.inviteToken ?? randomBytes(24).toString('hex');

  const manager = await prisma.managerAccount.upsert({
    where: { email: MANAGER_EMAIL },
    update: { inviteToken },
    create: { email: MANAGER_EMAIL, inviteToken },
  });

  await prisma.managerMembership.upsert({
    where: { managerId_clubId: { managerId: manager.id, clubId: club.id } },
    update: { role: 'owner' },
    create: { managerId: manager.id, clubId: club.id, role: 'owner' },
  });

  // Korty / godziny / cennik — bez naturalnego unique, więc replace-all.
  // Kolejność kasowania: cennik i godziny przed kortami (FK courtId w PriceRule).
  await prisma.priceRule.deleteMany({ where: { clubId: club.id } });
  await prisma.openingHours.deleteMany({ where: { clubId: club.id } });
  await prisma.court.deleteMany({ where: { clubId: club.id } });

  await prisma.court.createMany({
    data: [
      { clubId: club.id, name: 'Kort 1', indoor: true },
      { clubId: club.id, name: 'Kort 2', indoor: false },
    ],
  });

  await prisma.openingHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      clubId: club.id,
      dayOfWeek,
      openFrom: '07:00',
      openTo: '23:00',
    })),
  });

  await prisma.priceRule.create({
    data: {
      clubId: club.id,
      dayFrom: 0,
      dayTo: 6,
      timeFrom: '07:00',
      timeTo: '23:00',
      slotMinutes: 90,
      priceGr: PRICE_GR,
    },
  });

  const courts = await prisma.court.count({ where: { clubId: club.id } });
  const hours = await prisma.openingHours.count({ where: { clubId: club.id } });

  console.log('Seed gotowy:');
  console.log(`  klub          ${club.name} (${club.slug}), status=${club.status}`);
  console.log(`  korty         ${courts}`);
  console.log(`  godziny       ${hours} dni, 07:00–23:00`);
  console.log(`  cennik        90 min = ${(PRICE_GR / 100).toFixed(2)} zł`);
  console.log(`  menedżer      ${manager.email}`);
  console.log(`  inviteToken   ${inviteToken}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
