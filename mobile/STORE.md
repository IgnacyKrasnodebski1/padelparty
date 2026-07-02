# PadelParty → App Store (Expo / React Native)

Natywna apka. Backend (`../server.js`) zostaje bez zmian — apka tylko z nim gada przez `src/config.ts`.

## Zanim zaczniesz (wymagania)
1. **Apple Developer Program — 99 USD / rok** → https://developer.apple.com/programs (rejestracja + akceptacja umów w App Store Connect).
2. **Konto Expo** (darmowe) → https://expo.dev
3. **Backend wystawiony w sieci (HTTPS)** — telefon nie dosięgnie `localhost`. Postaw `server.js` np. na Render/Railway (patrz `../README.md`) i weź publiczny adres, np. `https://padelparty.onrender.com`.
4. Mac z Xcode (do finalnej wysyłki / testów w symulatorze; sam build robi chmura EAS).

## Krok po kroku

### 1. Wskaż apce backend  ✅ ZROBIONE
`src/config.ts` już wskazuje na produkcję: `https://padelparty.onrender.com`
(zmieniaj tylko jeśli postawisz backend gdzie indziej).

### 2. Zainstaluj EAS i zaloguj się
```bash
cd mobile
npm install -g eas-cli
eas login
```

### 3. Powiąż projekt z Twoim kontem
```bash
eas init          # utworzy projectId i wpisze go do app.json
```
> `bundleIdentifier` w `app.json` to `com.padelparty.app` — jeśli zajęty, zmień na własny (np. `com.twojanazwa.padelparty`). Ten sam string wpisz przy tworzeniu apki w App Store Connect.

### 4. Zbuduj wersję na iOS (w chmurze EAS)
```bash
eas build --platform ios --profile production
```
EAS przeprowadzi Cię przez logowanie Apple i sam ogarnie certyfikaty/provisioning. Na końcu dostajesz plik `.ipa` w chmurze.

### 5. Wyślij do App Store Connect / TestFlight
```bash
eas submit --platform ios --profile production
```
Apka pojawi się w **App Store Connect → TestFlight**. Tam:
- **TestFlight** = rozdaj ekipie od razu (link, do 100 testerów wewn. / do 10k zewn.). Lekka recenzja — najszybsza droga na telefony znajomych.
- **App Store (publicznie)** = wypełnij listing (opis, kategoria „Sport", zrzuty ekranu, **polityka prywatności**, pytania o dane) → „Submit for Review". Recenzja zwykle 1–3 dni.

## Do listingu App Store (przygotuję na życzenie)
- **Nazwa:** PadelParty
- **Ikona:** `assets/icon.png` (już 1024×1024 ✅)
- **Kategoria:** Sport
- **Zrzuty ekranu:** iPhone 6.7" i 6.5" (zrobisz z symulatora/telefonu)
- **Polityka prywatności (URL):** wymagana, bo są konta (login + hasło). Mogę wygenerować gotową stronę.
- **App Privacy:** zbierasz „User ID / login" do działania konta; brak trackingu, brak reklam.
- **Encryption:** `ITSAppUsesNonExemptEncryption: false` już ustawione w `app.json`.

## Testy lokalne przed buildem
```bash
# w telefonie: zainstaluj Expo Go, potem:
cd mobile && npx expo start
# zeskanuj QR. Ustaw w src/config.ts API_URL na http://IP-TWOJEGO-KOMPA:8099 (ta sama sieć WiFi),
# a backend odpal: cd .. && node server.js
```

## Uwaga o danych
Backend trzyma dane w `data.json`. Na darmowych hostingach z efemerycznym dyskiem może się kasować przy redeployu — na produkcję warto przełączyć na Postgres (drobna zmiana warstwy zapisu w `server.js`).
