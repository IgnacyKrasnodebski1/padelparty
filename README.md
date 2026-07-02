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

## Wrzucenie do sieci (hosting) — 1 kliknięcie

Repo jest już na GitHub: **https://github.com/IgnacyKrasnodebski1/padelparty**
W repo jest `render.yaml`, więc Render sam wie co postawić.

**Deploy jednym kliknięciem (Render, darmowy plan):**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/IgnacyKrasnodebski1/padelparty)

1. Kliknij przycisk → zaloguj się / załóż darmowe konto Render (możesz przez GitHub).
2. Render odczyta `render.yaml` i postawi serwis `padelparty`. Kliknij **Apply**.
3. Po chwili dostajesz publiczny adres, np. `https://padelparty.onrender.com`.
4. Ten adres = link do PWA (dodaj na telefonie do ekranu głównego) **oraz** wartość `API_URL` dla natywnej apki (`mobile/src/config.ts`).

Serwer sam czyta `PORT` z `process.env.PORT`. Health-check: `/healthz`. Polityka prywatności: `/privacy.html`.

> Darmowy plan Render usypia serwis po ~15 min bezczynności (pierwsze wejście po przerwie ~30 s) i ma efemeryczny dysk — `data.json` może zniknąć przy redeployu. Do stałego grania warto potem przełączyć zapis na Postgres (drobna zmiana w `server.js`).

## Natywna apka na App Store
Katalog `mobile/` to natywna apka **React Native (Expo)**. Pełna instrukcja buildu i wysyłki: **[mobile/STORE.md](mobile/STORE.md)**. Gotowy listing (opis, słowa kluczowe): **[mobile/STORE-LISTING.md](mobile/STORE-LISTING.md)**.

> Uwaga: `data.json` na darmowych hostingach z „efemerycznym" dyskiem może się kasować przy redeployu. Jak apka się przyjmie w ekipie, warto przełączyć bazę na Postgres/SQLite z trwałym dyskiem — łatwa podmiana warstwy zapisu w `server.js`.

## API (skrót)
- `POST /api/register` `{username,password,name,emoji,color}` → `{token,meId,data}`
- `POST /api/login` `{username,password}` → `{token,meId,data}`
- `GET /api/state` (Bearer token) → `{meId,data}`
- `POST /api/mutate` (Bearer token) `{type,payload}` → `{meId,data}`
  - typy: `addPlayer, delPlayer, addGame, addParty, joinParty, updateParty, addTournament, updateTournament, seedDemo, reset`
