# Tasks: Ekosystem klubów i rezerwacji (001-club-ecosystem)

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [data-model.md](data-model.md) · [contracts/api.md](contracts/api.md) · [research.md](research.md) · [quickstart.md](quickstart.md)

**Testy**: quickstart wymaga unit testów dla slotów/prowizji/lig (kryteria zaliczenia) — ujęte w fazach US1/US2. Pełny TDD nie był zamawiany.

---

## Phase 1: Setup

- [X] T001 Scaffold pakietu `backend/` (Express + TS strict + Prisma init, struktura modułów wg plan.md) — `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts`
- [X] T002 [P] Scaffold pakietu `club-web/` (Next.js 15 + TS strict, layout, theme brandowy PadelParty) — `club-web/package.json`, `club-web/app/layout.tsx`
- [X] T003 [P] Konfiguracja env i sekretów: `backend/.env.example` (DATABASE_URL, DIRECT_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, JWT_SECRET, PLATFORM_URL), `club-web/.env.example` (API_URL)
- [X] T004 [P] Vitest + supertest w backendzie (config, przykładowy test dymny) — `backend/vitest.config.ts`, `backend/tests/smoke.test.ts`

## Phase 2: Foundational (blokuje wszystkie user stories)

- [X] T010 Pełna `schema.prisma` wg data-model.md (Player, Account, ManagerAccount, ManagerMembership, Club, Court, PriceRule, OpeningHours, Booking+enum statusów, PaymentEvent, Payout, ClubCard, CardBatch, ClubMembership, League, Season, Game+clubId, Party, Tournament, Achievement, Referral, Event, EventTicket) + unique `(courtId, startsAt)` — `backend/prisma/schema.prisma`
- [ ] T011 Pierwsza migracja + generacja klienta — `backend/prisma/migrations/` *(klient wygenerowany, SQL `0001_init` gotowy offline; APPLY zablokowane: brak hasła DB Supabase)*
- [ ] T012 Middleware: `authPlayer` (Bearer P, legacy-kompatybilny), `errorHandler` (`{error}` + kody z contracts), `rateLimiter` — `backend/src/middleware/`
- [ ] T013 Port legacy API 1:1 na Prisma: `POST /api/register|login|logout`, `GET /api/state`, `POST /api/mutate` (wszystkie typy mutacji z server.js; identyczne kształty odpowiedzi) — `backend/src/modules/legacy/`
- [ ] T014 Skrypt migracji bloba: `migrate-kv.ts` (REST kv → tabele, tryb `--dry-run`, raport liczności) — `backend/src/scripts/migrate-kv.ts`
- [ ] T015 [P] `GET /healthz` (ok, storage=postgres, migracje, users count) — `backend/src/modules/health.ts`
- [ ] T016 [P] Seed dev: klub „Padel Warszawa Test" (invited) + zaproszenie menedżera + 2 korty + godziny 7–23 + cennik 90 min — `backend/src/scripts/seed.ts`
- [ ] T017 Auth menedżera: accept-invite → hasło (zxcvbn≥3) → TOTP setup/verify (otplib, QR otpauth://, 10 backup codes) → login 2-krokowy (`mfaToken`→`token`); middleware `authManager` egzekwujący ukończone TOTP (`401 MFA_REQUIRED`) — `backend/src/modules/auth/manager.ts`
- [ ] T018 Aktualizacja deployu: `render.yaml` — serwis `backend/` (build+start, DATABASE_URL sync:false), plan przełączenia ruchu z `server.js` — `render.yaml`
- [ ] T019 Testy foundational: legacy parity (register/login/state/mutate na Postgresie ≡ stare odpowiedzi) — `backend/tests/legacy-parity.test.ts`

**Checkpoint**: istniejąca apka mobilna działa na nowym backendzie bez zmian → dopiero wtedy user stories.

## Phase 3: US1 — Klub sprzedaje rezerwacje kortów (P1) 🎯 MVP część 1

**Goal**: klub skonfigurowany w <30 min; gracz rezerwuje i płaci w <2 min; prowizja naliczona.
**Independent test**: quickstart Scenariusz A + B (onboarding, płatność, wyścig 409, hold, anulacje).

- [ ] T020 [US1] Moduł clubs (panel): `GET/PATCH /api/mgr/club`, CRUD `courts`, `opening-hours` (replace-all), `price-rules`, `blocks` — `backend/src/modules/clubs/`
- [ ] T021 [US1] Stripe Connect: `POST /api/mgr/club/stripe/onboard` (Express account + account link), `GET .../stripe/status`; blokada publikacji slotów bez `chargesEnabled` — `backend/src/modules/payments/connect.ts`
- [ ] T022 [US1] Silnik dostępności: `GET /api/clubs/:slug/availability?date=` (godziny − rezerwacje − blokady; ceny z PriceRule, kort>klub) — `backend/src/modules/bookings/availability.ts`
- [ ] T023 [P] [US1] Unit testy dostępności i kolizji slotów (granice godzin, blokady, siatka slotMinutes) — `backend/tests/availability.test.ts`
- [ ] T024 [US1] Rezerwacja: `POST /api/bookings` (transakcja: insert pending_payment + PaymentIntent z `application_fee` 7% i `transfer_data.destination`; `409 SLOT_TAKEN` na unique-violation; `expiresAt` +10 min), `GET /api/bookings/:id` — `backend/src/modules/bookings/create.ts`
- [ ] T025 [US1] Webhook Stripe: `POST /api/stripe/webhook` (signature verify; PI.succeeded→confirmed, PI.failed→expired, refundy, account.updated; idempotencja po event.id w PaymentEvent) — `backend/src/modules/payments/webhook.ts`
- [ ] T026 [US1] Wygaszanie holdów (cron/interval: pending_payment po expiresAt → expired + cancel PI) — `backend/src/modules/bookings/expiry.ts`
- [ ] T027 [US1] Anulacje: `POST /api/bookings/:id/cancel` (okno `cancellationHours` → refund+refund_application_fee albo no_refund), `POST /api/mgr/bookings/:id/cancel` (zawsze refund), `GET /api/me/bookings`, `GET /api/mgr/bookings?from&to` — `backend/src/modules/bookings/cancel.ts`
- [ ] T028 [P] [US1] Unit testy prowizji i anulacji (7% zaokrąglenia w groszach; granice okna 24 h) — `backend/tests/commission.test.ts`
- [ ] T029 [US1] Panel: onboarding wizard (accept-invite → hasło → TOTP z QR → profil klubu → Stripe onboard) — `club-web/app/panel/onboarding/`
- [ ] T030 [P] [US1] Panel: korty + godziny + cenniki (formularze CRUD) — `club-web/app/panel/korty/page.tsx`
- [ ] T031 [P] [US1] Panel: kalendarz rezerwacji (siatka dzienna/tygodniowa, blokady ręczne, anulowanie z refundem) — `club-web/app/panel/kalendarz/page.tsx`
- [ ] T032 [US1] Mobile: ekran Kluby (lista → profil klubu → wybór dnia → siatka dostępności) — `mobile/src/screens/Clubs.tsx` + typy/API w `mobile/src/logic.ts`
- [ ] T033 [US1] Mobile: płatność PaymentSheet (`@stripe/stripe-react-native`; clientSecret → sheet → polling statusu; obsługa 409/410) + zakładka „Moje rezerwacje" — `mobile/src/screens/Clubs.tsx`, `mobile/App.tsx`
- [ ] T034 [US1] E2E wg quickstart B na Stripe test mode (karta 4242 + BLIK test; wyścig dwóch klientów; hold 10 min) — `backend/tests/e2e-booking.test.ts`

**Checkpoint US1**: samodzielny marketplace rezerwacji działa (Scenariusze A+B zielone).

## Phase 4: US2 — Karta klubu, ligi równoległe, ranking na żywo (P1) 🎯 MVP część 2

**Goal**: karta przy pierwszej wizycie → członkostwo+ligi; wynik gierki natychmiast rusza wszystkie tabele; ekran TV w recepcji.
**Independent test**: quickstart Scenariusz C + D.

- [ ] T040 [US2] Karty: batch generate (`PP-XXXX-XXXX` Crockford), eksport CSV/PDF, revoke; `POST /api/cards/activate` (unassigned→active, tworzy ClubMembership + auto-enroll do lig; `423 CARD_ALREADY_ACTIVE`) — `backend/src/modules/cards/`
- [ ] T041 [US2] Deep-link `GET /c/:code` (redirect: apka jeśli zainstalowana / landing klubu) — `backend/src/modules/cards/deeplink.ts`
- [ ] T042 [US2] Ligi: CRUD `POST/PATCH /api/mgr/leagues` (cykle weekly/monthly/yearly/custom, wiele aktywnych naraz, autoEnroll), Season auto-create — `backend/src/modules/leagues/`
- [ ] T043 [US2] Klasyfikacje: `GET /api/clubs/:slug/leagues` + `.../standings` (agregacja Game po clubId i zakresie sezonu; punkty/wygrane wg scoringu) — `backend/src/modules/leagues/standings.ts`
- [ ] T044 [P] [US2] Unit testy klasyfikacji (wiele lig naraz, granice sezonów, gierka bez clubId nie liczy się) — `backend/tests/standings.test.ts`
- [ ] T045 [US2] Atrybucja gierek: rozszerzenie legacy `addGame` o `clubId` (walidacja: członkostwo/karta LUB powiązana rezerwacja — FR-016) — `backend/src/modules/legacy/mutations.ts`
- [ ] T046 [US2] Zamykanie sezonów: `POST /api/mgr/seasons/:id/close` + cron dzienny (winners→Achievement, auto-otwarcie nowego sezonu) — `backend/src/modules/leagues/close.ts`
- [ ] T047 [US2] Osiągnięcia: model+zapis, `GET /api/me/achievements`, publiczna strona `/a/:sharedSlug` (OG image brandowany klubem, CTA do klubu) — `backend/src/modules/achievements/`, `club-web/app/a/[slug]/page.tsx`
- [ ] T048 [US2] Ekran TV: `GET /api/screen/:clubSlug?key=` + strona `screen/[clubSlug]` (top rankingu, dzisiejsze rezerwacje, auto-refresh 10 s, rotacja lig) — `backend/src/modules/screen.ts`, `club-web/app/screen/[clubSlug]/page.tsx`
- [ ] T049 [P] [US2] Panel: zarządzanie ligami (tworzenie z presetami cykli, podgląd tabel, zamknięcie sezonu) — `club-web/app/panel/ligi/page.tsx`
- [ ] T050 [P] [US2] Panel: karty (generuj pulę, eksport do drukarni, revoke, status aktywacji) — `club-web/app/panel/karty/page.tsx`
- [ ] T051 [US2] Mobile: skan karty (`expo-camera` + ręczny kod; sukces = brandowany toast klubu + auto-zapis do lig) — `mobile/src/screens/ScanCard.tsx`
- [ ] T052 [US2] Mobile: zakładki lig klubowych w Rankingach (moje kluby → liga → tabela, moja pozycja) + wybór klubu przy zapisie gierki w Play — `mobile/src/screens/Rankings.tsx`, `mobile/src/screens/Play.tsx`
- [ ] T053 [US2] Publiczny profil klubu `k/[clubSlug]` (landing z udostępnień/kart: opis, ligi, CTA pobierz apkę/zarezerwuj) — `club-web/app/k/[clubSlug]/page.tsx`

**Checkpoint US2 = MVP**: pilot z jednym klubem może ruszyć (Scenariusze A–D zielone).

## Phase 5: US3 — Jedna tożsamość w ekosystemie (P2)

**Goal**: profil, ranking i reputacja podążają między klubami; odkrywanie „w pobliżu".
**Independent test**: gracz klubu A wchodzi do klubu B bez nowego konta; ranking regionalny łączy oba.

- [ ] T060 [US3] Odkrywanie: `GET /api/clubs?city&lat&lng` (sort po odległości, filtr miasta) — `backend/src/modules/clubs/discovery.ts`
- [ ] T061 [US3] Ranking regionalny: agregacja cross-klubowa (miasto/region) na globalnym ELO — `backend/src/modules/leagues/regional.ts`
- [ ] T062 [US3] Mobile: „W pobliżu" (lista klubów z odległością; geolokalizacja `expo-location` za zgodą) + ranking regionalny w Rankingach — `mobile/src/screens/Clubs.tsx`, `mobile/src/screens/Rankings.tsx`
- [ ] T063 [US3] Profil publiczny gracza cross-klub (statystyki, kluby, osiągnięcia; widoczny w każdym klubie) — `backend/src/modules/players/profile.ts`, `mobile/src/screens/Profile.tsx`

## Phase 6: US4 — Wiralowy hak marketingowy (P2)

**Goal**: udostępnienia prowadzą nowych graczy do klubu; polecenia nagradzane; cykliczne wyróżnienia.
**Independent test**: quickstart D pkt 4 + polecony gracz po 1. gierce → nagroda przypisana.

- [ ] T070 [US4] Udostępnianie osiągnięć z apki (Share API → `/a/:slug`) + parametr `ref=` wiążący polecającego — `mobile/src/screens/Rankings.tsx`, `mobile/src/components.tsx`
- [ ] T071 [US4] Polecenia: model Referral, atrybucja przy rejestracji z `ref`, nagroda po pierwszej gierce poleconego (anty-abuse: unikalność, warunek gierki) — `backend/src/modules/referrals/`
- [ ] T072 [US4] Wyróżnienia cykliczne: cron „Klub tygodnia" / „Wspinaczka miesiąca" (największy skok w rankingu) → Achievement + materiał na ekran TV — `backend/src/modules/achievements/highlights.ts`
- [ ] T073 [P] [US4] OG-images generowane dla `/a/:slug` (branding klubu, wynik, CTA) — `club-web/app/a/[slug]/opengraph-image.tsx`

## Phase 7: US5 — Monetyzacja dookoła + panel statystyk (P3)

- [ ] T080 [US5] Statystyki panelu: `GET /api/mgr/stats?from&to` (przychody, prowizje, obłożenie %, aktywni gracze, retencja M1, **odsetek graczy z ≥1 gierką w klubie w miesiącu** — metryka SC-003) — `backend/src/modules/clubs/stats.ts`
- [ ] T081 [US5] Panel: dashboard statystyk (wykresy Recharts wg dataviz) — `club-web/app/panel/statystyki/page.tsx`
- [ ] T082 [US5] Wydarzenia płatne: CRUD Event + `EventTicket` ze sprzedażą przez PaymentIntent (reuse US1), lista uczestników — `backend/src/modules/events/`
- [ ] T083 [US5] Plany klubu: pole `planTier` + gating funkcji (free: 1 liga aktywna; pro: bez limitu + promowane eventy) — `backend/src/modules/clubs/plans.ts`
- [ ] T084 [P] [US5] Panel/mobile: tworzenie promowanego wydarzenia + kupno wejściówki — `club-web/app/panel/wydarzenia/page.tsx`, `mobile/src/screens/Clubs.tsx`

## Phase 8: US6 — Matchmaking / otwarte gierki (P3)

- [ ] T090 [US6] Otwarte gierki: model OpenGame (klub, termin, poziom ±, wolne miejsca), join/leave, powiązanie z rezerwacją przy komplecie — `backend/src/modules/opengames/`
- [ ] T091 [US6] Mobile: lista otwartych gierek w klubie + „szukam 4." (tworzenie, dołączanie, poziom z ELO) — `mobile/src/screens/Clubs.tsx`

## Final Phase: Polish & Cross-Cutting

- [ ] T100 Migracja produkcyjna: `migrate-kv` na prod blob → Postgres, przełączenie Render na `backend/`, wygaszenie `server.js`, smoke legacy (T019 na prod) — `render.yaml`, runbook w `specs/001-club-ecosystem/quickstart.md`
- [ ] T101 [P] RODO: eksport danych gracza (`GET /api/me/export`) + usunięcie konta (anonimizacja Game, twarde usunięcie PII) — `backend/src/modules/players/gdpr.ts`
- [ ] T102 [P] Rate limiting wrażliwych endpointów (login/TOTP/activate: 5/min) + audyt logów finansowych — `backend/src/middleware/rateLimit.ts`
- [ ] T103 Upgrade Render → Starter przed włączeniem płatności produkcyjnych (decyzja R7) + Stripe live keys przez dashboard — checklist w README
- [ ] T104 [P] `npx tsc --noEmit` czyste we wszystkich pakietach + CI GitHub Actions (typecheck+testy na push) — `.github/workflows/ci.yml`
- [ ] T105 iOS build v4 (Kluby+karty+ligi) → TestFlight (nieinteraktywny pipeline EAS) — `mobile/`
- [ ] T106 [P] Dokumentacja: aktualizacja `CLAUDE.md` i `README.md` (architektura 3 pakietów, env, runbook deploy hook)

---

## Dependencies

```
Setup (T001–T004)
  └─▶ Foundational (T010–T019)  ← BLOKUJE WSZYSTKO
        ├─▶ US1 (T020–T034)  ─┐
        │                      ├─▶ MVP (pilot 1 klub)
        └─▶ US2 (T040–T053)  ─┘   (US2 zależy od US1 tylko w T045-atrybucji przez rezerwację; karta działa bez rezerwacji)
              ├─▶ US3 (T060–T063) — wymaga klubów/członkostw z US1/US2
              ├─▶ US4 (T070–T073) — wymaga osiągnięć z US2
              ├─▶ US5 (T080–T084) — statystyki wymagają rezerwacji z US1
              └─▶ US6 (T090–T091) — wymaga klubów z US1
Polish (T100–T106) — po MVP; T100 przed wpuszczeniem pilota
```

## Parallel Examples

- **Setup**: T002, T003, T004 równolegle po T001.
- **US1**: po T020–T022 → T023 ∥ T024; front równolegle z backendem: T029 ∥ T030 ∥ T031 ∥ T032.
- **US2**: T040 ∥ T042 (różne moduły) → potem T043; T049 ∥ T050 ∥ T051 równolegle.
- **US1 ∥ US2 częściowo**: karty+ligi (T040–T044) nie dotykają bookings — dwie sesje mogą jechać równolegle wg zasad worktree z CLAUDE.md.

## Implementation Strategy

**MVP = Phase 1–4 (Setup + Foundational + US1 + US2)** → pilot z jednym klubem warszawskim (Scenariusze A–D z quickstart). Dopiero potem P2/P3 przyrostowo: US3 (sieć) → US4 (wzrost) → US5 (monetyzacja dookoła) → US6 (matchmaking). Po każdej fazie: checkpoint z quickstart + build TestFlight. Migracja prod (T100) dopiero po zielonych A–D na stagingu.
