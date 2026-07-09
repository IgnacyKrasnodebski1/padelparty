# Research — Ekosystem klubów i rezerwacji (001)

**Data**: 2026-07-09 · **Wejście**: [plan.md](plan.md) Technical Context · Wszystkie NEEDS CLARIFICATION rozstrzygnięte.

## R1. Płatności marketplace w PLN

- **Decision**: **Stripe Connect** (konta Express dla klubów) + destination charges z `application_fee_amount` (prowizja platformy). Metody: **BLIK, karty, Przelewy24**, waluta PLN. Mobile: PaymentSheet (`@stripe/stripe-react-native`).
- **Rationale**: Stripe wspiera BLIK (1,6% + 1 zł) i P24 (1,9% + 1 zł) w Polsce ([pricing](https://stripe.com/en-pl/pricing/local-payment-methods), [BLIK docs](https://docs.stripe.com/payments/blik), [P24 docs](https://docs.stripe.com/payments/p24)); Connect ma wbudowany onboarding kont klubów (KYC robi Stripe, nie my), automatyczne wypłaty i rozliczenie prowizji w jednej transakcji ([Connect pricing](https://stripe.com/en-pl/connect/pricing)). Najkrótsza droga do „płatności od dnia 1" z FR-004/FR-006.
- **Alternatives considered**: PayU/Przelewy24 marketplace (bardziej „lokalne", ale cięższy onboarding sprzedawców i słabsze SDK mobilne), Tpay (marketplace mniej dojrzały), Adyen (enterprise, przerost na MVP).
- **Konsekwencje**: zwroty przez Stripe Refunds (z `refund_application_fee=true` w oknie anulacji — plan.md Deferred #1); webhooki = źródło prawdy stanu płatności (tabela `payment_events`, idempotencja po `event.id`).

## R2. Backend: baza i framework

- **Decision**: Nowy pakiet `backend/` — **Express + Prisma + Supabase Postgres** (istniejący projekt `ciqwnobxopioznfzhhgj`; pooler 6543 w runtime, direct 5432 do migracji). Blob `kv` migrowany one-off skryptem do tabel relacyjnych; legacy endpointy `/api/*` odtworzone 1:1.
- **Rationale**: rezerwacje + pieniądze wymagają transakcji, constraintów (anty-double-booking) i audytu — blob JSON tego nie da. Stack Express+Prisma jest już opanowany w innych projektach usera (szybkość dowozu), Supabase już opłacone/używane (dziś trzyma blob).
- **Alternatives considered**: rozbudowa zero-deps `server.js` (brak transakcji/constraintów — odpada przy pieniądzach), Supabase klient JS zamiast Prisma (słabsze typowanie relacji i migracje), Fastify (brak przewagi istotnej dla zespołu).

## R3. Konta menedżerów klubów + obowiązkowe 2FA

- **Decision**: Własny moduł auth w `backend/`: e-mail + hasło (argon2/scrypt) + **TOTP** (otplib, QR do Google Authenticator/1Password) z kodami zapasowymi; sesje JWT krótkie + refresh. Gracze zostają na istniejącym lekkim auth (login+hasło).
- **Rationale**: jeden spójny system auth w naszym backendzie (gracze i menedżerowie w tych samych tabelach, różne polityki); TOTP bez kosztów SMS; wymaganie FR-064 spełnione od pierwszego logowania.
- **Alternatives considered**: Supabase Auth z MFA (gotowe, ale wprowadza DRUGI system tożsamości obok istniejących graczy i wiąże auth z vendorm), SMS 2FA (koszt + SIM-swap), passkeys (świetne, ale adopcja/UX na TV-recepcji niepewna — możliwe później).

## R4. Anty-double-booking

- **Decision**: Rezerwacja = wiersz z **unikalnym constraintem `(court_id, starts_at)`** tworzony w transakcji ze statusem `pending_payment` i TTL 10 min (wygasa → slot wraca). Potwierdzenie dopiero po webhooku `payment_intent.succeeded`. Blokady ręczne klubu (`manual_block`) w tej samej tabeli slotów zajętych.
- **Rationale**: constraint w bazie = gwarancja twarda (FR-005/FR-008) niezależna od logiki aplikacji i wyścigów; hold 10 min to standard w bookingach z płatnością (BLIK wymaga chwili na potwierdzenie w aplikacji banku).
- **Alternatives considered**: exclusion constraint na tstzrange (elegancki, ale sloty są dyskretne — prostszy unique wystarcza), lock aplikacyjny/Redis (dodatkowy komponent, słabsza gwarancja).

## R5. Panel klubu i ekran TV

- **Decision**: Nowy pakiet `club-web/` — **Next.js na Vercel**. Panel pod auth menedżera; **ekran TV** jako publiczny route `screen/[clubSlug]?key=<screen_token>` (odczyt-only, token unieważnialny), odświeżanie **pollingiem co 10 s**; publiczny profil klubu `k/[clubSlug]` jako landing z udostępnień (US4).
- **Rationale**: panel z kalendarzem/analityką przerasta vanilla PWA; Next+Vercel = znany userowi deploy „push→live"; polling 10 s spełnia SC-005 przy zerowej złożoności (SSE/WebSocket zbędne na MVP).
- **Alternatives considered**: rozbudowa index.html (nieutrzymywalne przy tej złożoności), osobna apka Expo dla klubów (przerost — panel to desktop/tablet web), SSE (dodatkowa infrastruktura na Render free — polling wystarcza).

## R6. Karty klubu (fizyczne)

- **Decision**: Pula kart generowana w panelu: kod `PP-XXXX-XXXX` (Crockford base32, bez O/0/I/1) + **QR z deep-linkiem** `https://padelparty.onrender.com/c/<kod>`; eksport **CSV/PDF do drukarni**. Skan w apce graczy: `expo-camera` + ręczne wpisanie kodu jako fallback. Kod jednorazowo wiązany z kontem (aktywacja), unieważnialny i re-wydawalny (FR-017).
- **Rationale**: deep-link w QR działa też dla osób BEZ apki (trafiają na landing klubu → instalacja → kod czeka) — karta staje się kanałem akwizycji, nie tylko atrybucji (US4). Format czytelny do przepisania ręcznie.
- **Alternatives considered**: NFC (drożej w druku, iOS wymaga apki i tak), sam QR bez kodu tekstowego (brak fallbacku przy zniszczonym nadruku).

## R7. Hosting backendu przy płatnościach

- **Decision**: Rekomendacja **Render Starter ($7/mc)** dla `backend/` od momentu włączenia płatności; do tego czasu free + keep-warm zostaje. Webhooki Stripe z retry łagodzą zimne starty, ale produkcyjnie serwis nie może spać.
- **Rationale**: webhook `payment_intent.succeeded` decyduje o potwierdzeniu rezerwacji — opóźnienie 50 s na zimnym starcie psuje UX rezerwacji „na już"; $7/mc to koszt pomijalny wobec prowizji z jednego dnia rezerwacji.
- **Alternatives considered**: pozostanie na free (ryzyko UX), Railway/Fly (migracja bez potrzeby — Render już skonfigurowany, deploy hook działa).

## R8. Parametry domyślne biznesu (konfigurowalne per klub)

- **Decision**: prowizja platformy **7%** rezerwacji (per-klub w kontrakcie, pole w DB); okno darmowej anulacji **24 h** (0–72 h per klub); sloty **90 min** domyślnie (30/60/90/120 wybieralne); hold płatności **10 min**; sezony lig: presety tygodniowy/miesięczny/roczny + własny zakres dat.
- **Rationale**: 7% mieści się w widełkach marketplace'ów sportowych (5–15%) i zostawia klubowi wyraźną większość; 24 h to standard kortowy w PL; 90 min to typowa gierka padlowa.
- **Alternatives considered**: prowizja kwotowa od slotu (mniej skaluje się z ceną), brak okna anulacji (wrogie dla graczy — zabija SC-002/retencję).

## R9. Migracja danych legacy (blob → Postgres)

- **Decision**: Skrypt `backend/src/scripts/migrate-kv.ts`: czyta blob `kv` przez REST, wstawia do tabel (users→players/accounts, games, parties, tournaments) w jednej transakcji, weryfikuje liczności, zapisuje raport. Stary `server.js` działa do przełączenia DNS-a ruchu na nowy backend (ta sama ścieżka `/api/*`), potem deprecated.
- **Rationale**: zero utraty istniejących kont/gierek ekipy; przełączenie bez zmiany w apce mobilnej (ten sam kontrakt legacy).
- **Alternatives considered**: świeży start bez migracji (utrata rankingów ekipy — nieakceptowalne), dual-write (złożoność bez korzyści przy jednorazowej migracji).
