# Kontrakt API — backend/ (001)

Baza: `https://padelparty.onrender.com`. JSON; kwoty w groszach; czasy ISO-8601 UTC. Błędy: `{ "error": string }` + status. Auth: `Authorization: Bearer <token>`; dwa typy tokenów — **P** (gracz, legacy) i **M** (menedżer; wydawany dopiero po zaliczeniu TOTP).

## 0. Legacy (bez zmian kontraktu — port 1:1 z server.js)
```
POST /api/register            {login,password,name,emoji,color} → {token,meId,data}
POST /api/login               {login,password}                  → {token,meId,data}
GET  /api/state         [P]                                     → {meId,data}
POST /api/mutate        [P]   {type,payload}                    → {meId,data}
POST /api/logout        [P]
GET  /healthz                                                    → {ok,storage,...}
```
`data` rozszerzone o: `clubs` (członkostwa gracza), `myCards`, `clubLeagues` (do zakładek lig w Rankingach).

## 1. Auth menedżera (2FA obowiązkowe)
```
POST /api/mgr/accept-invite   {inviteToken,email,password}      → {setupToken}         # z maila zaproszenia (kuratorowany onboarding)
POST /api/mgr/totp/setup      [setupToken]                      → {otpauthUrl,backupCodes}
POST /api/mgr/totp/verify     [setupToken] {code}               → {token}              # dopiero tu konto staje się aktywne
POST /api/mgr/login           {email,password}                  → {mfaToken}           # krok 1
POST /api/mgr/login/totp      {mfaToken,code}                   → {token}              # krok 2 (lub backupCode)
POST /api/mgr/logout    [M]
```

## 2. Klub — konfiguracja (panel) [M]
```
GET  /api/mgr/club                                               → pełny obiekt klubu
PATCH /api/mgr/club              {name?,description?,logoUrl?,brandColor?,cancellationHours?}
POST /api/mgr/club/stripe/onboard                                → {onboardingUrl}     # Stripe Connect Express
GET  /api/mgr/club/stripe/status                                 → {chargesEnabled,payoutsEnabled}
POST /api/mgr/courts             {name,indoor}                   → Court
PATCH/DELETE /api/mgr/courts/:id
POST /api/mgr/opening-hours      [{dayOfWeek,openFrom,openTo}]   → zastępuje komplet
POST /api/mgr/price-rules        {courtId?,dayFrom,dayTo,timeFrom,timeTo,slotMinutes,priceGr} → PriceRule
DELETE /api/mgr/price-rules/:id
POST /api/mgr/blocks             {courtId,startsAt,endsAt,note?} → Booking(kind=manual_block)
DELETE /api/mgr/blocks/:id
```

## 3. Rezerwacje
```
GET  /api/clubs                        ?city&lat&lng             → [{id,slug,name,city,logoUrl,distanceKm?}]
GET  /api/clubs/:slug                                            → profil publiczny (korty, godziny, aktywne ligi, top rankingu)
GET  /api/clubs/:slug/availability     ?date=YYYY-MM-DD          → [{courtId,courtName,slots:[{startsAt,endsAt,priceGr,available}]}]
POST /api/bookings              [P]    {courtId,startsAt}        → {bookingId,clientSecret,expiresAt}   # tworzy pending + Stripe PaymentIntent
GET  /api/bookings/:id          [P]                              → {status,...}         # polling po płatności
POST /api/bookings/:id/cancel   [P]                              → {status,refunded:bool}
GET  /api/me/bookings           [P]                              → lista gracza
GET  /api/mgr/bookings          [M]    ?from&to                  → kalendarz klubu
POST /api/mgr/bookings/:id/cancel [M]                            → cancelled_by_club (zawsze refund)
POST /api/stripe/webhook               (Stripe-Signature)        → 200                  # PI.succeeded/failed, refunds, account.updated
```

## 4. Karty klubu
```
POST /api/mgr/cards/batches     [M]   {count}                    → {batchId,cards:[{code,qrUrl}]}  # + eksport
GET  /api/mgr/cards/batches/:id/export?format=csv|pdf [M]        → plik do drukarni
POST /api/mgr/cards/:code/revoke [M]                             → {status:"revoked"}
POST /api/cards/activate        [P]   {code}                     → {club,membership,joinedLeagues}  # skan/wpis kodu
GET  /c/:code                          (bez auth)                → redirect: apka jeśli jest / landing klubu (akwizycja)
```

## 5. Ligi i rankingi
```
POST /api/mgr/leagues           [M]   {name,cycle,autoEnroll,scoring,customRange?} → League(+pierwszy Season)
PATCH /api/mgr/leagues/:id      [M]   {status?}                                    # pauza/koniec
POST /api/mgr/seasons/:id/close [M]                              → {winners,nextSeasonId}
GET  /api/clubs/:slug/leagues                                    → [{league,season,myRank?,topN}]
GET  /api/clubs/:slug/leagues/:leagueId/standings ?seasonId      → pełna klasyfikacja
GET  /api/me/achievements       [P]                              → [{type,label,club,sharedSlug}]
GET  /a/:sharedSlug                    (bez auth)                → strona osiągnięcia (OG image, link do klubu — US4)
```
Atrybucja gierki (FR-016): istniejące `POST /api/mutate {type:"addGame"}` przyjmuje dodatkowo `clubId?` — walidowane: gracz ma aktywną kartę/członkostwo klubu albo gierka powiązana z rezerwacją.

## 6. Ekran TV i statystyki
```
GET /api/screen/:clubSlug             ?key=<screenToken>         → {leagues:[{name,top10}],todayBookings,liveMatches}  # polling 10 s
GET /api/mgr/stats              [M]   ?from&to                   → {revenueGr,commissionGr,occupancyPct,activePlayers,retentionPct}
```

## Kody błędów istotne kontraktowo
- `409 SLOT_TAKEN` (rezerwacja przegrała wyścig) · `410 BOOKING_EXPIRED` (hold minął) · `402 PAYMENT_REQUIRED` (PI nieopłacony)
- `423 CARD_ALREADY_ACTIVE` · `404 CARD_UNKNOWN` · `403 CLUB_NOT_ACTIVE`
- `401 MFA_REQUIRED` (menedżer bez ukończonego TOTP)
