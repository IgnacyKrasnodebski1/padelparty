# Implementation Plan: Ekosystem klubów i rezerwacji (Club Ecosystem)

**Branch**: `001-club-ecosystem` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-club-ecosystem/spec.md`

## Summary

Przekształcenie PadelParty z apki dla ekipy w dwustronny ekosystem gracze↔kluby. MVP (1 klub pilotażowy): kuratorowany onboarding klubu, korty+cennik+sloty, **rezerwacje z płatnością online od dnia 1** (Stripe Connect, PLN, prowizja platformy), **fizyczna karta klubu** (QR → członkostwo + atrybucja gierek), **równoległe ligi** (tygodniowa/miesięczna/roczna) liczone z istniejących gierek, ranking na żywo w apce i na **ekranie TV klubu**, panel klubu (web). Techniczne jądro zmiany: wyjście z zero-deps `server.js` + blob KV na **backend Express+Prisma na Supabase Postgres** (transakcje, współbieżność, audyt finansowy), nowa apka web **Next.js** (panel klubu + ekran TV), rozszerzenie istniejącej apki Expo (odkrywanie klubów, rezerwacja+płatność, skan karty, ligi).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) wszędzie; Node.js 20 (backend), React Native 0.86 / Expo SDK 57 (mobile), Next.js 15 (club-web)

**Primary Dependencies**: backend: Express, Prisma ORM, Stripe SDK (Connect), otplib (TOTP 2FA), zod; mobile: @stripe/stripe-react-native (PaymentSheet), expo-camera (skan QR), istniejące expo-linear-gradient/AsyncStorage; club-web: Next.js + Recharts (analityka panelu)

**Storage**: Supabase **Postgres** (istniejący projekt `ciqwnobxopioznfzhhgj`; pooler 6543 + direct 5432, migracje Prisma). Migracja: obecny blob `kv` (players/games/parties/tournaments) → tabele relacyjne (skrypt one-off). Stripe jako źródło prawdy zdarzeń płatniczych (webhooki → tabela `payment_events`).

**Testing**: Vitest (unit: sloty/kolizje/ligi/prowizje), testy kontraktowe API (supertest), Stripe test mode + CLI webhook forwarding; `npx tsc --noEmit` we wszystkich pakietach

**Target Platform**: iOS (TestFlight/App Store), web PWA (gracze — legacy), web panel klubu + ekran TV (przeglądarka/TV), backend na Render (upgrade z Free na Starter — webhooki płatności nie mogą spać), club-web na Vercel

**Project Type**: mobile-app + web-service + web-app (monorepo 3 pakiety)

**Performance Goals**: potwierdzenie rezerwacji p95 < 500 ms (bez czasu 3DS); aktualizacja rankingu widoczna < 2 s od zapisu wyniku; ekran TV odświeża ≤ 10 s; SC-002: pełny flow rezerwacji < 2 min

**Constraints**: płatności online od dnia 1 (BLIK/karty/P24, PLN); zero podwójnych rezerwacji (constraint DB, nie logika aplikacyjna); konta klubów: e-mail + silne hasło + **obowiązkowe TOTP 2FA**; gracze bez zmian (login+hasło, zero tarcia); RODO (eksport/usunięcie danych gracza); terminologia „login" (nie „ksywa")

**Scale/Scope**: MVP: 1 klub, 2–6 kortów, ~200 graczy; faza Warszawa: ~30 klubów, ~10 k graczy, ~1 k rezerwacji/tydz. — architektura bez przebudowy (indeksy, paginacja, cache rankingów dopiero gdy trzeba)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Brak `constitution.md` w repo PadelParty — brak formalnych gate'ów. Przyjęte zasady robocze (z praktyki projektu): TypeScript strict wszędzie, zero `any`; jeden klient API po stronie mobile; sekrety wyłącznie w env (nigdy w repo); każda kwota pieniężna w groszach (int), nigdy float. **PASS** (initial i post-design — brak naruszeń).

## Project Structure

### Documentation (this feature)

```text
specs/001-club-ecosystem/
├── plan.md              # Ten plik
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1 — kontrakt REST backendu
└── tasks.md             # Phase 2 (/speckit-tasks — NIE tworzone tutaj)
```

### Source Code (repository root)

```text
backend/                       # NOWE — zastępuje server.js
├── prisma/
│   ├── schema.prisma          # pełny model (data-model.md)
│   └── migrations/
├── src/
│   ├── index.ts               # bootstrap Express
│   ├── middleware/            # authPlayer, authManager (+2FA), errors, rateLimit
│   ├── modules/
│   │   ├── auth/              # gracze (legacy-compat) + menedżerowie (email+TOTP)
│   │   ├── legacy/            # 1:1 porty /api/state, /api/mutate → nowe tabele
│   │   ├── clubs/             # kluby, korty, cenniki, zaproszenia (kuratorowane)
│   │   ├── bookings/          # sloty, rezerwacje, anulacje
│   │   ├── payments/          # Stripe Connect: intents, webhooki, refundy, wypłaty
│   │   ├── cards/             # pule kart klubu, aktywacja skanem, unieważnianie
│   │   ├── leagues/           # ligi równoległe, klasyfikacje, zamknięcia sezonów
│   │   └── screen/            # publiczne read-only API ekranu TV
│   └── scripts/migrate-kv.ts  # one-off: blob kv → Postgres
└── tests/                     # unit + kontraktowe

club-web/                      # NOWE — Next.js
├── app/
│   ├── panel/                 # panel klubu (auth: email+2FA)
│   │   ├── kalendarz/         # rezerwacje, blokady ręczne
│   │   ├── korty/             # korty + cenniki
│   │   ├── ligi/              # tworzenie/zamykanie lig
│   │   ├── karty/             # generowanie puli kart, druk/eksport
│   │   └── statystyki/        # przychody, obłożenie, retencja
│   ├── screen/[clubSlug]/     # ekran TV (publiczny, klucz w query)
│   └── k/[clubSlug]/          # publiczny profil klubu (landing z udostępnień)
└── ...

mobile/                        # ISTNIEJĄCE — rozszerzenie
├── src/
│   ├── screens/Clubs.tsx      # NOWE: odkrywanie, profil klubu, rezerwacja+płatność
│   ├── screens/ScanCard.tsx   # NOWE: skan QR karty klubu
│   ├── screens/Rankings.tsx   # ROZSZERZENIE: zakładki lig klubowych
│   ├── screens/Play.tsx       # ROZSZERZENIE: przypisanie gierki do klubu
│   └── logic.ts / store.tsx   # typy + API dla klubów/rezerwacji/lig

index.html                     # PWA graczy — tryb legacy-compat (bez nowych funkcji klubowych w MVP)
server.js                      # DEPRECATED po migracji — wygaszany
```

**Structure Decision**: monorepo z trzema pakietami (`backend/`, `club-web/`, `mobile/`). Nowy `backend/` przejmuje CAŁE API (w tym istniejące endpointy graczy 1:1 pod dotychczasowymi ścieżkami `/api/*` — obecna apka mobilna i PWA działają bez zmian w dniu przełączenia), potem dochodzą moduły klubowe. `server.js` zostaje wygaszony po migracji danych.

## Complexity Tracking

Bez naruszeń — sekcja pusta.

## Deferred z /speckit-clarify — rozstrzygnięcia planistyczne

1. **Anulacje / kto ponosi prowizję**: polityka per klub — okno darmowej anulacji (default **24 h**, konfigurowalne 0–72 h). Anulacja w oknie: pełny zwrot graczowi, prowizja platformy również zwracana (pilot — prostota i fair play). Po oknie: brak zwrotu, klub zatrzymuje należność. Szczegóły stanów w data-model.md.
2. **Kalibracja rankingu cross-klubowego**: MVP liczy ELO globalnie (jedna pula, jak dziś) + rankingi klubowe filtrowane po `club_id` gierki. Formalna kalibracja między klubami (osobne pule/korekty) odłożona do fazy Warszawa — dane z pilota posłużą do strojenia.
