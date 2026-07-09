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

## Kryteria zaliczenia fazy
Wszystkie scenariusze A–E zielone + `npx tsc --noEmit` czyste we wszystkich pakietach + testy jednostkowe slotów/prowizji/lig przechodzą.
