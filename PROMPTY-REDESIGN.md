# Prompty do Claude Code — redesign v2

Jeden etap = jedna sesja Claude Code = jeden commit (albo kilka).
NIE wklejaj wszystkiego naraz. Po każdym etapie: `cd mobile && npx tsc --noEmit`, odpal apkę, dopiero potem następny.

Zasady obowiązujące w każdym etapie (Claude Code dostaje je w prompcie, ale warto wiedzieć):
TypeScript strict, zero `any`; teksty po polsku; „login", nigdy „ksywa";
zero `expo-linear-gradient`, zero emoji w UI; tekst na volt/flame zawsze `#0A0C0F`;
cele dotyku ≥ 44 px; po każdej zmianie typecheck.

---

## Etap 0 — gałąź i higiena

```
Jesteśmy na branchu 001-club-ecosystem, a redesign to osobny wątek.
Załóż gałąź 002-redesign-v2 z main (nie z obecnej), przenieś na nią niezacommitowane
DESIGN-V2.md, PROMPTY-REDESIGN.md i zmianę w CLAUDE.md, zacommituj jako
"docs: spec redesignu v2 (Night Court)". Nie dotykaj niczego w specs/001-club-ecosystem.
Na koniec pokaż mi git log --oneline -3 i git status.
```

---

## Etap 1 — fundament: fonty, tokeny, komponenty, nawigacja

```
Przeczytaj DESIGN-V2.md (sekcje 1–4) i zaimplementuj sam fundament — bez dotykania ekranów.

1. Fonty: npx expo install expo-font @expo-google-fonts/archivo @expo-google-fonts/manrope
   plus react-native-svg. Ładowanie fontów w App.tsx ze splashem do czasu załadowania.
   Jeśli Archivo Expanded nie jest dostępne w paczce — użyj Archivo_900Black i zgłoś mi to,
   nie kombinuj z transformami.
2. mobile/src/theme.ts: wywal G (gradienty) i stary C, wstaw C, AV, R dokładnie jak w §1 spec.
3. mobile/src/components.tsx: przepisz wg tabeli z §3. Avatar = inicjały (2 znaki) na AV[color],
   Btn ma warianty primary/secondary/destructive/icon, Hero znika na rzecz ScreenHeader.
   Dodaj Toggle, ListRow, CourtCard. Ikony jako komponenty SVG w nowym pliku src/icons.tsx.
4. App.tsx: ciemny tab bar wg §4, ikony SVG, StatusBar light.
5. Usuń expo-linear-gradient z package.json i z importów.

Ekrany będą się na chwilę sypać — to OK, naprawimy je w etapie 2, ale tsc --noEmit ma przejść.
Commit: "feat(ui): fundament Night Court — tokeny, komponenty, nawigacja".
```

---

## Etap 2 — sześć istniejących ekranów

```
Przeczytaj DESIGN-V2.md §5 („Istniejące") i przeprojektuj po kolei:
Auth, Home, Play, Rankings, Tournaments (widok szczegółu), Profile.
Używaj wyłącznie komponentów i tokenów z etapu 1 — zero lokalnych StyleSheetów z kolorami hex.

Szczegóły, o których łatwo zapomnieć:
- Rankings: podium znika, zastępuje je karta lidera na volt + lista ListRow, własny wiersz podświetlony.
- Play: scoreboard to dwie połowy z liczbą 68 px, pasek proporcji volt/flame pod spodem.
- Profile: siatka 6 statystyk + pasek formy W/P (8 ostatnich).
- Auth i Profile: wybór avatara emoji wylatuje, zostaje sam wybór koloru.
  Pole emoji zostaw w modelu i wysyłaj domyślne '🎾' do API, żeby backend się nie wywrócił.

Po każdym ekranie tsc --noEmit. Commit per ekran: "feat(ui): <ekran> w nowym designie".
```

---

## Etap 3 — model danych pod nowe ekrany

```
Przeczytaj DESIGN-V2.md §6 i §7b („Model danych dla ekip"). To etap bez UI.

W logic.ts, store.tsx i server.js dodaj:
- Party.rules: { target: 16|21|24|32, courts: number, goldBall, handicap, ranked: boolean }
  z migracją: stare party bez rules dostają domyślne { target: 21, courts: 1, ranked: true }.
- addGame ma zwracać eloDelta: Record<playerId, number> policzone po stronie serwera.
- Team / TeamMember / TeamInvite / Match dokładnie wg §7b.
  UWAGA: Team i „Squad" (zapisany skład) to JEDEN byt — nie twórz dwóch.
- Nowe typy mutate: addTeam, updateTeam, joinTeam, leaveTeam, inviteToTeam, respondTeamInvite,
  setMemberRole, addMatch, updateMatch, rsvpMatch.

Zachowaj wsteczną zgodność: istniejące data.json / blob w Supabase ma się wczytać bez błędu.
Dopisz testy w backend/tests na migrację i na eloDelta.
Commit: "feat(model): zasady party, ekipy, zaplanowane mecze, eloDelta".
```

---

## Etap 4 — flow „nowe party robi się samo"

```
Przeczytaj DESIGN-V2.md §5 („Nowe"), ekrany 7–12. Zbuduj ścieżkę:
Start → Skład → Zasady → Zaproszenie → Party na żywo → Wynik.

Sedno: karta „Szybka gierka" na ekranie Start ma z ostatniego party skopiować skład i rules
i od razu utworzyć party — jedno tapnięcie, zero formularza. To jest najważniejszy element
całego redesignu, zrób go pierwszy i pokaż mi, zanim ruszysz z resztą.

Skład: podpowiedź „graliście razem…" liczona z games, przyciski zapisanych ekip,
licznik i komunikat czy skład dzieli się przez 4.
Zasady: przełączniki z §5 pkt 9, zdanie-podsumowanie generowane z ustawień.
Wynik: korzysta z eloDelta z etapu 3, nie przelicza ELO u siebie.

Commit per ekran.
```

---

## Etap 5 — historia i turnieje

```
DESIGN-V2.md §5, ekrany 13–14.
Historia: podsumowanie tygodnia, filtry (Wszystkie/Moje/Americano/Turnieje),
gierki grupowane po dniu i party.
Turnieje — lista: karta turnieju live z paskiem rund, sekcja Cykliczne z przełącznikiem,
zakończone z nazwiskiem zwycięzcy. Widok szczegółu turnieju masz już z etapu 2.
Commit: "feat(ui): historia i lista turniejów".
```

---

## Etap 6 — ekipy

```
Przeczytaj DESIGN-V2.md §7b w całości. Zbuduj 7 ekranów: Teams, TeamNew, Team,
TeamMembers, TeamInvite, TeamMatchNew, TeamMatch.

Wejścia: ikona ludzi w nagłówku ekranu Party, „Zarządzaj" w Profilu, „Ekipy" na ekranie Start.
TeamInvite: lista „grałeś z nimi, nie są w ekipie" liczona z games — wspólni gracze
posortowani po liczbie wspólnych gierek, bez obecnych członków i już zaproszonych.
TeamMatch: „Startuj party" tworzy Party z osób z rsvp === 'yes' i zapisuje partyId na meczu.
Uprawnienia: tylko admin ekipy może zapraszać, zmieniać role i usuwać członków — egzekwuj to
w server.js, nie tylko w UI.
Commit per ekran.
```

---

## Etap 7 — braki, których nie ma w makietach

```
Tego nie ma na canvasie — zaprojektuj wg systemu z DESIGN-V2.md i pokaż mi, zanim dopieścisz.

1. Powiadomienia push (expo-notifications): token zapisywany przy loginie,
   zgoda proszona PO pierwszym udanym zaproszeniu, nie na starcie.
   Powiadomienia: zaproszenie do ekipy, nowy mecz w ekipie, ktoś potwierdził/odmówił,
   mecz za 2h, wynik zapisany. Bez tego cała warstwa ekip i RSVP jest martwa.
2. Zaproszenie dla kogoś spoza apki: link prowadzi na rejestrację i po założeniu konta
   automatycznie wchodzi do ekipy / party z którego przyszedł link.
3. Stany puste: brak ekip, brak gierek, brak turniejów, nowa ekipa bez historii.
4. Błędy i offline: Render na free usypia — pierwsze wejście po przerwie trwa ~30 s.
   Potrzebny stan „budzę serwer" z sensownym tekstem zamiast spinnera w próżni,
   retry i komunikat przy braku sieci.
5. Onboarding po rejestracji: 3 ekrany — załóż ekipę / dołącz kodem / zagraj solo.

Commit per punkt.
```

---

## Etap 8 — przed startem

```
1. Ikona i splash: weź projekt z planszy „Marka" (piłka volt na grafitowym tle, wariant
   odwrócony), wygeneruj mobile/assets/icon.png, adaptive-icon, splash-icon
   oraz icon-192/512, apple-touch-icon.png i icon.svg w katalogu głównym.
2. Zaktualizuj mobile/STORE-LISTING.md i README.md pod nowy wygląd i nowe funkcje (ekipy).
3. Przejrzyj CLAUDE.md — zaktualizuj sekcję Stack (nie ma już expo-linear-gradient,
   są nowe fonty i react-native-svg).
4. Build i wysyłka na TestFlight wg CLAUDE.md.
5. Powiedz mi wprost, co z hostingiem: free tier Render usypia i ma efemeryczny dysk.
   Jeśli zostajemy na free, wypisz ryzyka. Jeśli nie — zaproponuj najtańszy sensowny wariant.
```
