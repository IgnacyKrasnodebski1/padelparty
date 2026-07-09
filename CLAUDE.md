# PadelParty 🎾

Apka do padla: gierki, rankingi (ELO), turnieje Americano/Mexicano, party ze znajomymi.
W budowie: **ekosystem klubów** (rezerwacje kortów z płatnością, ligi klubowe, karta klubu) — spec `specs/001-club-ecosystem/`.

**To jest samodzielny projekt.** NIE mieszać z repo STAYZ/PMS (`~/Desktop/STAYZ`) — zero wpisów, symlinków czy speców tam.

## Stack

- **Mobile** (`mobile/`): Expo SDK 57, React Native 0.86, TypeScript strict; bez zewnętrznego routera (własne taby w `App.tsx`); expo-linear-gradient, AsyncStorage (token)
- **Web PWA graczy** (`index.html`): vanilla JS, jeden plik, service worker (`sw.js`), manifest — tryb legacy
- **Backend** (`server.js`): czysty Node zero-deps; dane jako JSON blob w Supabase (tabela `kv`, projekt `ciqwnobxopioznfzhhgj`) przez REST; fallback plik `data.json` (w .gitignore)
- Docelowo (spec 001): `backend/` Express+Prisma+Supabase Postgres, `club-web/` Next.js (panel klubu + ekran TV), Stripe Connect (PLN, BLIK/P24)

## Produkcja / pipeline

- **Backend live**: https://padelparty.onrender.com (Render, blueprint `padelparty`, region Frankfurt, plan Free). Health: `/healthz`. Polityka prywatności: `/privacy.html`. UWAGA: auto-deploy bywa wyłączony — po pushu sprawdź, czy wstało; free tier usypia (keep-warm: GitHub Actions `.github/workflows/keep-warm.yml` co 5 min)
- **GitHub**: https://github.com/IgnacyKrasnodebski1/padelparty (gh zalogowany jako IgnacyKrasnodebski1)
- **iOS**: EAS build+submit działa NIEINTERAKTYWNIE (cert + profil na koncie Apple FUNZY SP Z O O, `ascAppId` w `mobile/eas.json`):
  ```bash
  cd mobile
  npx eas-cli@latest build -p ios --profile production --non-interactive --no-wait
  npx eas-cli@latest submit -p ios --latest --non-interactive
  ```
  App Store Connect: apka „PadelParty (5715bd)", ID 6787083827. TestFlight = dystrybucja do ekipy.
- **Apka mobilna → backend**: `mobile/src/config.ts` (`API_URL`). Do testów lokalnych przestawić na `http://localhost:8099`, PRZED pushem wrócić na produkcję.

## Konwencje

- TypeScript strict, zero `any`; po każdej zmianie `cd mobile && npx tsc --noEmit`
- Terminologia: **„login"**, nigdy „ksywa" (decyzja produktowa). Konta graczy = niskotarciowe (login+hasło); konta klubów (spec 001) = e-mail + silne hasło + obowiązkowe 2FA
- Kwoty pieniężne wyłącznie w **groszach (int)**, nigdy float
- Teksty UI po polsku, user-friendly; toasty zamiast surowych błędów
- Sekrety tylko w env (Render → Environment); nigdy w repo

## Spec-kit (pipeline features)

`/speckit-specify → /speckit-clarify → /speckit-plan → /speckit-tasks → /speckit-implement`
Feature bieżąca: `specs/001-club-ecosystem` (gałąź `001-club-ecosystem`) — spec + clarifications DONE, `plan.md` w trakcie (research.md niedokończony). `.specify/feature.json` wskazuje aktywny katalog.

## Active Technologies (feature 001-club-ecosystem)
- Backend docelowy: Express + Prisma + **Supabase Postgres** (pooler 6543 runtime / direct 5432 migracje); płatności **Stripe Connect** (Express accounts, BLIK/P24/karty, PLN, destination charges + application_fee); 2FA menedżerów: TOTP (otplib)
- club-web: **Next.js na Vercel** (panel klubu, ekran TV `screen/[slug]?key=`, publiczny profil `k/[slug]`, strony osiągnięć `/a/[slug]`)
- mobile: + `@stripe/stripe-react-native` (PaymentSheet), `expo-camera` (skan kart QR `PP-XXXX-XXXX`)
- Artefakty planu: `specs/001-club-ecosystem/{plan,research,data-model,quickstart}.md` + `contracts/api.md`

## Komendy dev

```bash
node server.js                                   # backend lokalnie :8099 (bez env → plik data.json)
cd mobile && npx expo start --web --port 8090    # apka w przeglądarce
cd mobile && npx expo start                      # QR dla Expo Go na telefonie
cd mobile && npx tsc --noEmit                    # typecheck
```
