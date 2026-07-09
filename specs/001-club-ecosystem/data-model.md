# Data Model — Ekosystem klubów (001)

Postgres (Supabase) przez Prisma. Konwencje: id = cuid/uuid; kwoty w **groszach (int)**; czasy w UTC (`timestamptz`); soft-delete tylko tam, gdzie wskazano. Poniżej encje z kluczowymi polami — pełna precyzja typów w `schema.prisma` na etapie implementacji.

## Tożsamość

### Player (istniejący, rozszerzony)
| pole | typ | uwagi |
|---|---|---|
| id | id | |
| name, emoji, color | string | jak dziś |
| accountId | FK→Account? | null = gracz „dopisany" bez konta (jak dziś) |
| createdAt | ts | |

### Account (logowanie graczy — jak dziś, tabela zamiast bloba)
| pole | typ | uwagi |
|---|---|---|
| id, login (unique), passHash | | login min. 2 znaki; terminologia „login" (FR-065) |
| playerId | FK→Player | 1:1 |

### ManagerAccount (nowe — konta klubowe, FR-064)
| pole | typ | uwagi |
|---|---|---|
| id, email (unique, verified), passHash | | silne hasło (min. 10, zxcvbn≥3) |
| totpSecret, totpEnabled | | **2FA obowiązkowe** — bez ukończonej aktywacji TOTP konto nie ma dostępu do panelu |
| backupCodes | string[] hash | 10 jednorazowych |
| createdAt, lastLoginAt | | |

### ManagerMembership
ManagerAccount ↔ Club, rola `owner | staff`. Unique (managerId, clubId).

## Klub i infrastruktura

### Club
| pole | typ | uwagi |
|---|---|---|
| id, slug (unique), name, description | | slug do URL-i publicznych |
| city, address, lat, lng | | odkrywanie „w pobliżu" (FR-023) |
| logoUrl, brandColor | | branding kart/tytułów (FR-014/015) |
| status | enum | `invited → active → suspended` — **kuratorowane** (FR-001): rekord tworzy platforma, zaproszenie mailem do menedżera |
| commissionPct | int (bps) | domyślnie 700 = 7% (R8) |
| cancellationHours | int | domyślnie 24 (0–72) |
| stripeAccountId | string? | konto Connect Express; wymagane przed publikacją slotów |
| screenToken | string | token widoku TV (unieważnialny) |
| planTier | enum | `free \| pro \| club_plus` (FR-040; MVP: free) |

### Court
id, clubId FK, name („Kort 1"), surface?, indoor bool, active bool.

### PriceRule
clubId/courtId?, dayOfWeek zakres, timeFrom–timeTo, slotMinutes (30/60/90/120), priceGr (int, grosze). Kolejność: bardziej szczegółowa reguła wygrywa (kort > klub).

### OpeningHours
clubId, dayOfWeek, openFrom, openTo. Sloty generowane z godzin + slotMinutes (nie materializujemy pustych slotów — dostępność liczona on-read: godziny − rezerwacje − blokady).

## Rezerwacje i pieniądze

### Booking
| pole | typ | uwagi |
|---|---|---|
| id, clubId, courtId, playerId | FK | playerId = rezerwujący (musi mieć Account) |
| startsAt, endsAt | ts | **UNIQUE (courtId, startsAt)** — twardy anty-double-booking (R4) |
| priceGr, commissionGr | int | zamrożone w momencie rezerwacji |
| status | enum | patrz maszyna stanów |
| paymentIntentId | string? | Stripe PI |
| expiresAt | ts? | hold 10 min dla `pending_payment` |
| kind | enum | `booking \| manual_block` — blokady recepcji jako wiersze tej samej tabeli (unikalność działa identycznie) |

**Maszyna stanów Booking**:
```
pending_payment ──(webhook PI.succeeded)──▶ confirmed ──(czas minął)──▶ completed
      │(TTL 10 min / PI.failed)                  │(anulacja ≤ okno)──▶ cancelled_refunded
      ▼                                          │(anulacja > okno)──▶ cancelled_no_refund
   expired                                       │(klub odwołał)────▶ cancelled_by_club (zawsze refund)
```

### PaymentEvent (audyt, FR-063)
id, bookingId?/eventType/stripeEventId (unique — idempotencja), amountGr, feeGr, payloadJson, createdAt. Append-only.

### Payout (informacyjnie)
Wypłatami zarządza Stripe; trzymamy lustro: clubId, stripePayoutId, amountGr, status, arrivalDate — do panelu „przychody".

## Karta klubu i członkostwo

### ClubCard
| pole | typ | uwagi |
|---|---|---|
| id, clubId | FK | |
| code | string unique | `PP-XXXX-XXXX` (Crockford, R6) |
| batchId | FK→CardBatch | pula do druku (CSV/PDF eksport) |
| status | enum | `unassigned → active → revoked` |
| playerId | FK? | ustawiane przy aktywacji (skan/wpis kodu); jeden kod = jedno konto |
| activatedAt, revokedAt | ts? | re-wydanie = nowa karta, dorobek zostaje przy playerId (FR-017) |

### ClubMembership
playerId ↔ clubId, joinedAt, source (`card | booking | invite`), status (`active | left`). Unique (playerId, clubId). Tworzone automatycznie przy aktywacji karty lub pierwszej rezerwacji. Gracz może mieć wiele członkostw (FR-024).

## Ligi i rywalizacja

### League
| pole | typ | uwagi |
|---|---|---|
| id, clubId, name | | np. „Tygodniówka", „Liga Miesiąca" |
| cycle | enum | `weekly \| monthly \| yearly \| custom` — **wiele aktywnych równolegle** (FR-010) |
| autoEnroll | bool | domyślnie true — członkowie klubu wpadają automatycznie |
| scoring | enum | `points \| wins` (spójnie ze scoringiem gierek) |

### Season
leagueId, startsAt, endsAt, status (`active → closed`), winnersJson (podium po zamknięciu, FR-013). Zamykanie: cron dzienny + „zamknij teraz" w panelu; nowy sezon otwiera się automatycznie.

### Game (istniejąca, rozszerzona)
+ `clubId FK?` — atrybucja wg FR-016: ustawiana automatycznie z rezerwacji **lub** ze skanu karty przy zapisie wyniku; bez tego gierka nie liczy się do klubu. + indeks (clubId, ts).

**Klasyfikacje** (ranking klubu, sezonów, regionalny): liczone on-read z Game po (clubId, zakres dat sezonu) — bez tabel snapshotów w MVP (SC-005 osiągalne indeksami przy skali pilota; cache dopiero gdy pomiar pokaże potrzebę). ELO globalne bez zmian (plan.md Deferred #2).

### Achievement
id, playerId, clubId?, type (`season_winner | title | streak | record`), label, seasonId?, sharedSlug (unique — publiczny link/obrazek OG, FR-014/030), createdAt.

### Referral (US4)
id, referrerPlayerId, referredPlayerId (unique), source (`share | card | invite`), rewardStatus (`pending → granted` po 1. gierce poleconego — anty-abuse FR-031), createdAt.

## Wydarzenia (US5 — poza MVP, model przygotowany)
Event: clubId, name, startsAt, capacity, priceGr?, promoted bool. EventTicket: eventId, playerId, paymentIntentId, status.

## Widok „ekran klubu" (FR-012)
Bez własnych tabel — czyta: aktywne sezony + top rankingu + dzisiejsze rezerwacje/mecze. Autoryzacja: `Club.screenToken` w URL.

## Reguły walidacji (przekrojowo)
- Rezerwacja tylko w granicach OpeningHours i siatki slotMinutes; start w przyszłości.
- Anulacja gracza: dozwolona dla `confirmed`; refund wg `cancellationHours` (R8).
- Aktywacja karty: kod `unassigned`, klub `active`; drugi skan tego samego kodu → błąd „karta już aktywna".
- Publikacja slotów klubu wymaga: ≥1 kort, ≥1 PriceRule, OpeningHours, `stripeAccountId` z ukończonym onboardingiem.
- Wynik gierki z atrybucją klubu aktualizuje wszystkie **aktywne** sezony lig klubu, w których gracz jest zapisany (FR-011).
