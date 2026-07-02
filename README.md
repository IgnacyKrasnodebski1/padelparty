# PadelParty 🎾

Prosta, kolorowa apka do padla dla Ciebie i ekipy. **Konta bez maili** (sama ksywa + hasło), wspólne rankingi, dane trzymane na serwerze — logujesz się z każdego urządzenia i zapis nie znika.

## Co potrafi
- **Konta od ręki** — rejestracja: ksywa + hasło (min. 3 znaki) + avatar. Zero weryfikacji mailem. Logowanie z dowolnego urządzenia.
- **Wspólna przestrzeń** — wszyscy z ekipy widzą te same rankingi, party i turnieje.
- **Party** — jedna osoba tworzy party i zaprasza linkiem (`#join=KOD`) lub 5-znakowym kodem; reszta realnie dołącza (kod działa między urządzeniami przez serwer).
- **Tryby gry** — 🎯 Americano (do 21) i 🎾 Klasyk (sety), singiel 1v1 lub debel 2v2.
- **Zapis gierek** — każdy wynik ląduje na serwerze i liczy się do rankingów.
- **5 rankingów** — 🏆 Generalny (ELO), 🔥 Zwycięzcy, 🎯 Król Americano, ⚡ Na fali (passa), 🏓 Maszyny (aktywność).
- **Turnieje** — Americano z rotacją partnerów, wybór formatu / liczby rund / uczestników, opcja „co tydzień". Wpisujesz wyniki → live klasyfikacja, mecze wpadają do rankingów.

## To jest apka na telefon (PWA)
PadelParty instaluje się na telefonie jak zwykła apka — z **ikoną na ekranie głównym**, odpala się na **pełnym ekranie** (bez paska przeglądarki), ma splash i działa offline. Bez App Store / Google Play.

**iPhone (Safari):** otwórz link apki → przycisk Udostępnij ⬆️ → **„Do ekranu początkowego"**.
**Android (Chrome):** otwórz link → wyskoczy **„Zainstaluj aplikację"** (albo przycisk 📲 w apce / menu ⋮ → „Zainstaluj").

> Żeby instalacja i tryb offline działały, apka musi być otwarta przez **HTTPS** (czyli z hostingu, patrz niżej) albo z `localhost`. Sam plik z dysku / `http://IP-w-sieci` da radę pograć, ale bez pełnej instalacji.

## Architektura
- `index.html` — cały frontend (vanilla JS, zero buildu).
- `server.js` — backend w czystym Node (**zero zależności npm**): serwuje frontend + API `/api/*`, hashuje hasła (scrypt), trzyma dane w pliku `data.json`.
- `manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-*.png`, `apple-touch-icon.png` — warstwa PWA (instalacja + offline).
- `data.json` — baza (tworzy się sama przy pierwszym uruchomieniu; jest w `.gitignore`).

## Uruchomienie lokalne
```bash
cd ~/Desktop/PadelParty
node server.js        # http://localhost:8099
```
Na tej samej sieci WiFi znajomi wejdą przez `http://TWOJE-IP-LAN:8099`.

## Wrzucenie do sieci (żeby grać z telefonów z każdego miejsca)
To zwykła apka Node — postaw ją za darmo np. na **Render / Railway / Fly.io**:
1. Wrzuć folder na GitHub.
2. Nowy web service → build: (brak), start command: `node server.js`.
3. Host ustawia `PORT` sam (serwer to czyta z `process.env.PORT`).
4. Dostajesz publiczny link — dodaj go na telefonie do ekranu głównego jak apkę.

> Uwaga: `data.json` na darmowych hostingach z „efemerycznym" dyskiem może się kasować przy redeployu. Jak apka się przyjmie w ekipie, warto przełączyć bazę na Postgres/SQLite z trwałym dyskiem — łatwa podmiana warstwy zapisu w `server.js`.

## API (skrót)
- `POST /api/register` `{username,password,name,emoji,color}` → `{token,meId,data}`
- `POST /api/login` `{username,password}` → `{token,meId,data}`
- `GET /api/state` (Bearer token) → `{meId,data}`
- `POST /api/mutate` (Bearer token) `{type,payload}` → `{meId,data}`
  - typy: `addPlayer, delPlayer, addGame, addParty, joinParty, updateParty, addTournament, updateTournament, seedDemo, reset`
