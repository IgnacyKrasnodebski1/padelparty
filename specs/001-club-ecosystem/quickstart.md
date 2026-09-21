# Quickstart — walidacja end-to-end (001)

Przewodnik uruchomienia i scenariusze dowodzące, że feature działa. Szczegóły endpointów: [contracts/api.md](contracts/api.md); model: [data-model.md](data-model.md).

## Wymagania wstępne
- Node 20, konto Stripe w **test mode** + `stripe` CLI (`stripe listen --forward-to localhost:4000/api/stripe/webhook`)
- Supabase Postgres: `DATABASE_URL` (pooler 6543) + `DIRECT_URL` (5432) w `backend/.env`
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`, `PLATFORM_URL`

## Uruchomienie lokalne
```bash
cd backend && npx prisma migrate dev && npm run dev          # :4000
cd club-web && npm run dev                                   # :3000 (panel + ekran TV)
cd mobile && npx expo start --web --port 8090                # apka graczy (API_URL → localhost:4000)
```
Seed: `npm run seed` (backend) — tworzy klub „Padel Warszawa Test" (status `invited`), zaproszenie menedżera, 2 korty, godziny 7–23, cennik 90 min.

## Scenariusz A — onboarding klubu (US1, SC-001: <30 min)
1. Z seeda weź `inviteToken` → `accept-invite` → setup TOTP (zeskanuj QR w Authenticatorze) → verify.
2. W panelu: uzupełnij profil, przejdź onboarding Stripe (test mode — dane testowe Stripe).
3. **Oczekiwane**: `stripe/status → chargesEnabled:true`; profil klubu widoczny w apce graczy w „Kluby w pobliżu"; sloty opublikowane.
4. **Negatywny**: logowanie menedżera bez TOTP → `401 MFA_REQUIRED`.

## Scenariusz B — rezerwacja z płatnością (US1, SC-002: <2 min)
1. W apce gracza: klub → jutro 19:00 → rezerwuj → PaymentSheet → karta testowa `4242…` (oraz osobno: BLIK test).
2. **Oczekiwane**: booking `pending_payment` → po webhooku `confirmed`; kalendarz panelu pokazuje rezerwację; `PaymentEvent` zapisany z prowizją 7%.
3. **Wyścig**: dwóch graczy ten sam slot (dwa równoległe POST) → jeden `201`, drugi `409 SLOT_TAKEN`.
4. **Hold**: nie płać 10 min → status `expired`, slot znów dostępny.
5. **Anulacje**: anuluj >24 h przed → `cancelled_refunded` (refund w Stripe test); <24 h → `cancelled_no_refund`.

## Scenariusz C — karta klubu (US2/US4)
1. Panel: wygeneruj batch 10 kart → pobierz CSV → weź kod.
2. Apka gracza: skanuj QR (lub wpisz kod) → **oczekiwane**: członkostwo utworzone, gracz auto-zapisany do aktywnych lig, toast z brandingiem klubu.
3. Drugi gracz ten sam kod → `423 CARD_ALREADY_ACTIVE`. Revoke w panelu → karta martwa, dorobek gracza bez zmian.
4. Otwórz `GET /c/<nieaktywowany-kod>` w przeglądarce bez apki → landing klubu (ścieżka akwizycji).

## Scenariusz D — ligi równoległe + ranking na żywo (US2, SC-005)
1. Panel: utwórz DWIE ligi naraz: „Tygodniówka" (weekly) i „Liga Miesiąca" (monthly), autoEnroll.
2. Apka: zapisz gierkę z `clubId` (gracz z kartą) → **oczekiwane**: obie klasyfikacje zaktualizowane natychmiast (odśwież standings), gierka bez `clubId` NIE liczy się do lig.
3. Ekran TV: otwórz `screen/padel-warszawa-test?key=<screenToken>` na drugim ekranie → wynik pojawia się ≤10 s po zapisie.
4. Zamknij sezon Tygodniówki w panelu → zwycięzca dostaje Achievement; otwórz `/a/<sharedSlug>` bez logowania → strona osiągnięcia z linkiem do klubu.

## Scenariusz E — migracja legacy (R9)
1. Na kopii prod bloba: `npm run migrate:kv -- --dry-run` → raport liczności (users/games/parties/tournaments) zgodny z blobem.
2. Po migracji: istniejące konto ekipy loguje się starym `POST /api/login`, rankingi/historia identyczne jak przed migracją.

## Przełączenie ruchu: server.js → backend/ (runbook T018/T100)

`render.yaml` opisuje już nowy backend, ale sam merge do `main` NIE jest
przełączeniem — kolejność poniżej jest obowiązkowa. Najkrótszy opis ryzyka:
**dane muszą być w Postgresie ZANIM ruch tam trafi, a nowe klienty mogą wyjść
dopiero po backendzie.**

### 0. Warunki wstępne
- [ ] Hasło do bazy Supabase (dashboard → Settings → Database) — bez niego nie
      ma ani `DATABASE_URL`, ani `DIRECT_URL`.
- [ ] `npx prisma migrate deploy` wykonane na produkcyjnym Postgresie (26 tabel).
- [ ] `npm run migrate:kv -- --dry-run` na prod blobie: liczności zgodne,
      lista pominiętych zrozumiała (wiszące id po `delPlayer` są oczekiwane).
- [ ] Nowy build iOS w TestFlighcie — stary wysyła `username` i po cutoverze
      przestanie się logować.

### 1. Migracja danych (jeszcze bez przełączania ruchu)
1. Tryb tylko-do-odczytu de facto: uprzedź ekipę, żeby przez kilka minut nie
   zapisywała gierek — stary backend dalej pisze do bloba i zapisy z tego okna
   przepadną.
2. `npm run migrate:kv` (bez `--dry-run`) z ustawionymi `SUPABASE_URL`,
   `SUPABASE_KEY`, `DATABASE_URL`, `DIRECT_URL`.
3. Weryfikacja: liczniki z raportu zgadzają się z `/healthz` starego serwisu
   (`users`), a konto ekipy loguje się przez nowy backend starym hasłem.

### 2. Deploy backendu
4. Merge gałęzi do `main`; w Renderze zsynchronizuj blueprint (zmiana
   `rootDir`/`startCommand` wymaga akceptacji) i uzupełnij sekrety oznaczone
   `sync: false`.
5. Deploy. `startCommand` sam odpala `prisma migrate deploy` — deploy z
   niezaaplikowanym schematem ma paść, a nie wstać i sypać błędami.
6. Sprawdź `/healthz`: `storage: "postgres"`, `migration: "0001_init"`,
   `migrationPending: false`, `users` zgodne z migracją.
7. Sprawdź, że PWA wstaje pod `/` (nowy backend serwuje statyki z korzenia repo).

### 3. Klienty
8. PWA jedzie razem z backendem (ten sam serwis, ten sam deploy).
9. Wypuść build iOS z TestFlighta do ekipy.

### Odwrót
Przywróć w Renderze poprzedni `startCommand` (`node server.js`) i usuń
`rootDir` — `server.js` oraz blob KV zostają nietknięte przez całą operację,
więc cofnięcie jest natychmiastowe. Kosztem są zapisy wykonane na Postgresie
po cutoverze: NIE wracają do bloba, trzeba je przenieść ręcznie. Dlatego
decyzję o odwrocie podejmujemy w pierwszych minutach, nie po dniu.

`server.js` usuwamy dopiero, gdy nowy backend przeżyje kilka dni (T100).

## Kryteria zaliczenia fazy
Wszystkie scenariusze A–E zielone + `npx tsc --noEmit` czyste we wszystkich pakietach + testy jednostkowe slotów/prowizji/lig przechodzą.
