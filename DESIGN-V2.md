# PadelParty — redesign v2 („Night Court")

Handoff dla Claude Code. Źródło prawdy dla wyglądu: canvas „PadelParty — redesign"
(16 artboardów: 390×844 ekrany + plansze `System designu` i `Marka`).
Ten plik jest kontraktem implementacyjnym — jeśli coś się rozjeżdża z canvasem, wygrywa canvas.

## 0. Co się zmienia w skrócie

Stary UI: jasne tło, gradienty `expo-linear-gradient`, emoji jako ikony i awatary, kolorowe hero per ekran.
Nowy UI: ciemna baza, **zero gradientów**, **zero emoji w UI**, jeden akcent (volt), typografia tablicy wyników.

Do usunięcia z kodu: `expo-linear-gradient` (komponenty `Hero`, `Btn grad`, podium w `Rankings`),
tablica `EMOJIS` jako awatary, `G` (gradienty) z `theme.ts`.

## 1. Tokeny — nowy `mobile/src/theme.ts`

```ts
export const C = {
  bg: '#0A0C0F',        // tło aplikacji
  surface: '#14181E',   // karty
  raised: '#1B2027',    // przyciski wtórne, ikony
  nav: '#0E1116',       // tab bar, dolne paski
  line: '#262D37',      // obramowania interaktywne
  lineSoft: '#1E242C',  // separatory w kartach
  ink: '#F4F6F8',       // tekst główny
  sub: '#C3CBD6',       // tekst na przyciskach wtórnych
  muted: '#8A93A1',     // etykiety, nadpisy sekcji
  dim: '#6C7683',       // metadane
  faint: '#4A5460',     // nieaktywne, separator wyniku
  volt: '#D6FF3E',      // akcent: akcja, wygrana, drużyna A
  voltSoft: 'rgba(214,255,62,0.12)',
  flame: '#FF6A3D',     // live, drużyna B, akcja destrukcyjna
  flameText: '#FF8A63',
  flameSoft: 'rgba(255,106,61,0.14)',
  onAccent: '#0A0C0F',  // tekst na volt i flame — ZAWSZE ten
} as const;

// awatar = inicjały na tonowanym tle; tint po kolorze gracza
export const AV: Record<string, { bg: string; fg: string }> = {
  volt:   { bg: '#2B3A16', fg: '#D6FF3E' },
  blue:   { bg: '#23303D', fg: '#9FD0FF' },
  orange: { bg: '#3A2A1C', fg: '#FFB98A' },
  purple: { bg: '#33243A', fg: '#D6AEE8' },
  teal:   { bg: '#1E2A2A', fg: '#8FD9C8' },
  pink:   { bg: '#2E2430', fg: '#E3A9C8' },
};

export const R = { chip: 12, btn: 15, card: 20, sheet: 26, pill: 999 } as const;
```

Cienie: **nie ma**. Hierarchię robi tło + 1 px obramowanie (`C.line` / `C.lineSoft`).

## 2. Typografia

Dwa kroje z Google Fonts:

```bash
cd mobile && npx expo install expo-font @expo-google-fonts/archivo @expo-google-fonts/manrope
```

- **Display** — Archivo 900, `textTransform: 'uppercase'`, `letterSpacing: -0.5` przy 24 px+.
  Nagłówki ekranów, nazwy, **wszystkie liczby** (ELO, wyniki, punkty, licznik rund).
- **Body** — Manrope 400/700/800. Treść, etykiety, nazwy graczy.
- **Nadpisy sekcji** — Manrope 800/900, 10–11 px, `letterSpacing: 1.6`, uppercase, `C.muted`.

Skala: H1 ekranu 34 (Main/Rankingi/Turnieje) lub 22–24 (ekrany drill-in), wynik na scoreboardzie 68,
liczba w kafelku 22–24, tekst 13–16, metadane 11.

> DECYZJA DO PODJĘCIA: canvas używa **Archivo Expanded** (`font-stretch: 125%`).
> `@expo-google-fonts/archivo` daje tylko zwykłą szerokość. Albo (a) zostajemy przy Archivo_900Black
> i akceptujemy węższy nagłówek, albo (b) wrzucamy `Archivo_Expanded-Black.ttf` do `mobile/assets/fonts/`.
> Rekomendacja: (b) — to jest to, co robi charakter marki.

## 3. Komponenty — `mobile/src/components.tsx`

| Było | Jest |
|---|---|
| `Hero` (gradient) | `ScreenHeader` — kicker (uppercase, muted) + H1 display, bez tła, bez zaokrągleń |
| `Btn grad="g1"` | `Btn variant="primary"` — tło `C.volt`, tekst `C.onAccent`, wysokość 52, radius 15 |
| `Btn ghost` | `variant="secondary"` — `C.surface` + 1 px `C.line`, tekst `C.sub` |
| — | `variant="destructive"` — przezroczyste, obramowanie `#4A2520`, tekst `C.flame` |
| `Avatar` (emoji) | `Avatar` — inicjały (2 znaki, uppercase) na `AV[color]`, radius 12 przy 34 px |
| `Badge` | bez zmian logicznie; LIVE = kropka 6 px `C.flame` + tekst w `C.flameSoft` |
| `Segmented` | pigułki w kontenerze `C.surface`, aktywna = `C.volt` + `C.onAccent` |
| `Tile` | bez cienia, `C.surface` + `C.lineSoft`, liczba display |
| `Sheet` | tło `C.bg`, grip `C.line` |
| — | **`Toggle`** — track 50×30, on: `C.volt` + knob `C.onAccent`, off: `C.line` + knob `C.muted` |
| — | **`ListRow`** — rank / avatar / nazwa+sub / wartość; używany w rankingu, klasyfikacji, ekipie |
| — | **`CourtCard`** — nagłówek „KORT n", dwie strony, wynik lub inputy |

Ikony: `react-native-svg`, stroke 2 px, `strokeLinecap="round"`, rozmiar 18–24, kolor z tokenów.
Komplet użytych ikon jest na planszy `System designu` (dom, piłka, słupki, puchar, osoba, płomień,
udostępnij, hash, strzałka, ptaszek, kalendarz, rotacja).
Minimalny obszar dotyku: **44 px**.

## 4. Nawigacja

`App.tsx`: tab bar `C.nav`, górna krawędź 1 px `C.lineSoft`, wysokość 86 (iOS safe area).
Ikona 21 px + etykieta 10 px/800. Aktywna zakładka `C.volt`, nieaktywna `#6C7683`.
Zakładki bez zmian: Party · Gramy · Rankingi · Turnieje · Ja. `StatusBar` zawsze `light`.

## 5. Ekrany

### Istniejące (przeprojektowane 1:1)
1. **Wejście** (`Auth.tsx`) — wordmark + hasło, segmented Rejestracja/Logowanie, login + hasło,
   wybór koloru (**bez emoji**), CTA „Zakładam konto".
2. **Party / start** (`Home.tsx`) — pozdrowienie + data, 3 kafelki (ELO / Wygrane / Passa),
   CTA „Nowe party" + przycisk kodu, karta aktywnego party (LIVE, awatary, tryb, „Wejdź do party"),
   2 ostatnie gierki + link do Historii.
3. **Gramy** (`Play.tsx`) — segmented trybu, scoreboard: dwie połowy, liczba 68 px, ±,
   pasek proporcji volt/flame, chipy składu A (volt) i B (flame), CTA „Zapisz gierkę".
4. **Rankingi** (`Rankings.tsx`) — chipy rankingów, **karta lidera na volt** (zastępuje podium),
   lista `ListRow` z podświetleniem własnego wiersza.
5. **Turniej** (`Tournaments.tsx`, widok szczegółu) — pasek rund, karty kortów z inputami wyniku,
   klasyfikacja, „Losuj rundę n" + „Zapisz".
6. **Profil** (`Profile.tsx`) — awatar + ELO + miejsce, siatka 6 statystyk, pasek formy W/P,
   ekipa, wyloguj / wyczyść.

### Nowe (do napisania)
7. **Start party** (`Start.tsx`) — sedno redesignu: karta **„Szybka gierka"** (2v2, ostatni skład,
   ostatnie zasady — jedno tapnięcie = party gotowe), 4 kafelki trybów, lista **zapisanych składów**,
   „Mam kod" / „Od zera".
8. **Skład** (`Squad.tsx`) — podpowiedź „graliście razem w zeszłą środę → Dodaj",
   przyciski stałych ekip, dopisanie gracza, chipy z zaznaczeniem, licznik i komunikat
   („Skład równy — bez pauz" / „Ktoś będzie pauzował na zmianę"), sticky bar z „Dalej".
9. **Zasady** (`Rules.tsx`) — nazwa, „gramy do" 16/21/24/32, stepper kortów,
   przełączniki: złota piłka, handicap ELO, liczy się do rankingu, zapisz jako stały skład,
   zdanie-podsumowanie generowane z ustawień, CTA „Stwórz party".
10. **Zaproszenie** (`Invite.tsx`) — kod 5-znakowy, QR, „Wyślij link", lista kto dołączył.
11. **Party na żywo** (`PartyLive.tsx`) — czas party / liczba gierek / własne W,
    karty kortów z wynikiem na żywo, tabela party, „Zakończ" + „Losuj kolejną".
12. **Wynik** (`GameResult.tsx`) — wynik na volt, zwycięzcy, **zmiany ELO per gracz**,
    „co się zmieniło" (passa, awans, licznik gierek party), „Kolejna gierka".
13. **Historia** (`History.tsx`) — podsumowanie tygodnia, filtry, gierki grupowane po dniu/party.
14. **Turnieje — lista** (`Tournaments.tsx`, widok listy) — „Nowy turniej", karta live z paskiem rund,
    sekcja **Cykliczne** (przełącznik „co czwartek 20:00, tworzy się sam"), zakończone.

## 6. Czego brakuje w danych (backend + `logic.ts`)

Nowe ekrany potrzebują rzeczy, których model dziś nie ma:

- `Squad` — zapisany skład: `{ id, name, memberIds, defaultMode, rules, schedule? }`.
  Nowe typy w `POST /api/mutate`: `addSquad`, `updateSquad`, `delSquad`.
- `Party.rules` — `{ target: 16|21|24|32, courts: number, goldBall: boolean, handicap: boolean, ranked: boolean }`.
  Dziś party ma tylko `mode`. „Szybka gierka" kopiuje `rules` z ostatniego party.
- `addGame` powinno zwracać `eloDelta: Record<playerId, number>` — bez tego ekran Wyniku
  musi przeliczać ELO po stronie klienta (do uniknięcia).
- `Tournament.weekly` już istnieje, ale nie ma harmonogramu — sekcja „Cykliczne" potrzebuje
  `{ weekday, time }` i czegoś, co faktycznie tworzy turniej (na razie może być tylko UI + flaga).

Zasada: kwoty w groszach nie dotyczą, ale **punkty i ELO zawsze int**.

## 7. Kolejność robót

1. Fonty + `theme.ts` (usuń `G`, dodaj `C`, `AV`, `R`).
2. `components.tsx` — przepisz wg tabeli z §3, dodaj `Toggle`, `ListRow`, `CourtCard`, `ScreenHeader`.
   Wywal `expo-linear-gradient` z zależności.
3. `App.tsx` — tab bar + ikony SVG.
4. Przeprojektuj 6 istniejących ekranów (§5). Po każdym `npx tsc --noEmit`.
5. Model danych: `Squad` + `Party.rules` + `eloDelta` (server.js + logic.ts + store.tsx).
6. Nowe ekrany 7–14, w kolejności: Start → Skład → Zasady → Zaproszenie → Party na żywo → Wynik → Historia → Turnieje.
7. Ekipy: model (`Team`, `TeamMember`, `TeamInvite`, `Match`) + ekrany 15–21 z §7b.
8. Ikona i splash z planszy `Marka` → `mobile/assets/` + `icon-*.png`, `apple-touch-icon.png`, `icon.svg`.

## 7b. Ekipy — grupy znajomych (nowa warstwa)

Osobna oś produktu: **ekipa** = trwała grupa znajomych. Party jest jednorazowe, ekipa zostaje.
7 ekranów na canvasie, rząd „Ekipy — grupy znajomych".

15. **Ekipy** (`Teams.tsx`) — lista moich ekip (emblemat = monogram, liczba osób, liczba gierek,
    badge „GRA DZIŚ"), karta przychodzącego zaproszenia z Dołączam/Odrzuć, „Dołącz kodem".
    Wejście: ikona ludzi w nagłówku ekranu Party + „Zarządzaj" w Profilu.
16. **Nowa ekipa** (`TeamNew.tsx`) — nazwa + kolor (emblemat generuje się z inicjałów nazwy),
    domyślne zasady ekipy, prywatność (na zaproszenie / każdy z kodem), przełącznik osobnego rankingu ekipy.
17. **Ekipa** (`Team.tsx`) — profil grupy: 3 kafelki, „Nowa gierka" + „Zaproś",
    karta najbliższego terminu z RSVP, ranking ekipy (top 3), wejście w Członków.
18. **Członkowie** (`TeamMembers.tsx`) — lista z rolami ADMIN/GRACZ, ELO i licznikiem gierek,
    sekcja „Zaproszeni" z „Przypomnij", „Opuść ekipę".
19. **Zaproś** (`TeamInvite.tsx`) — kod słowny + QR + link, „Wyślij zaproszenie",
    lista **„grałeś z nimi, nie są w ekipie"** z przyciskiem Zaproś (stan „Wysłano"), szukanie po loginie.
20. **Nowa gierka w ekipie** (`TeamMatchNew.tsx`) — kiedy (dni + godziny), gdzie, ilu graczy (4/6/8),
    zasady ekipy z „Zmień", kogo pytamy (chipy członków + „Cała ekipa"), sticky bar z podsumowaniem.
21. **Mecz** (`TeamMatch.tsx`) — RSVP: pasek 5/6, moja odpowiedź (Idę / Może / Nie mogę),
    listy Idą / Jeszcze nie wiedzą, „Dorzuć kogoś", **„Startuj party"** → przechodzi w Party na żywo.

### Model danych dla ekip

- `Team` — `{ id, name, color, rules, privacy: 'invite'|'code', code, separateElo: boolean, createdAt }`.
- `TeamMember` — `{ teamId, playerId, role: 'admin'|'player', joinedAt }`.
- `TeamInvite` — `{ id, teamId, playerId?, code, status: 'pending'|'accepted'|'declined', invitedBy, createdAt }`.
- `Match` (zaplanowana gierka, różna od `Game` = rozegranej) —
  `{ id, teamId, startsAt, place, size: 4|6|8, rules, invitedIds, rsvp: Record<playerId,'yes'|'maybe'|'no'>, partyId? }`.
  „Startuj party" tworzy `Party` z `rsvp === 'yes'` i zapisuje `partyId` na meczu.
- `Party.teamId?` — party może (ale nie musi) należeć do ekipy; jeśli należy, dziedziczy `Team.rules`.
- Nowe typy w `POST /api/mutate`: `addTeam`, `updateTeam`, `joinTeam`, `leaveTeam`, `inviteToTeam`,
  `respondTeamInvite`, `setMemberRole`, `addMatch`, `updateMatch`, `rsvpMatch`.

Uwaga: `Squad` z §6 i `Team` to **to samo pojęcie** — nie rób dwóch bytów.
Zapisany skład z ekranu Zasady („zapisz jako stały skład") ma tworzyć `Team` z `privacy: 'invite'`.
Ekran „Twoje składy" na Starcie listuje `Team`, do których należę.

Sugestia „grałeś z nimi, nie są w ekipie" liczy się z `games` — wspólni gracze posortowani
po liczbie wspólnych gierek, odfiltrowani o obecnych członków i już zaproszonych.

## 8. Warunki odbioru

- `cd mobile && npx tsc --noEmit` czysto, zero `any`.
- Zero `expo-linear-gradient`, zero emoji w warstwie UI (emoji może zostać w modelu danych
  dla zgodności z API, ale nic go nie renderuje).
- Kontrast tekstu min. 4.5:1 (3:1 od 24 px). Tekst na volt i flame = `C.onAccent`, nigdy biały.
- Każdy cel dotyku ≥ 44 px, ikony bez etykiety mają `accessibilityLabel`.
- Teksty PL, terminologia: **„login"**, nigdy „ksywa".
- Ścieżka „Party → Nowe party → Szybka gierka" kończy się w Party na żywo bez żadnego formularza.
