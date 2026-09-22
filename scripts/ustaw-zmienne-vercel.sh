#!/usr/bin/env bash
# Przenosi sekrety z backend/.env.produkcja do zmiennych produkcyjnych Vercela.
# Wartości idą prosto z pliku do Vercela — nic nie jest wypisywane na ekran
# ani nie ląduje w historii powłoki.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${PP_ENV_FILE:-backend/.env.produkcja}"
[ -f "$ENV_FILE" ] || { echo "Brak $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

# JWT_SECRET to sekret aplikacji, nie Twój — generujemy losowy, jeśli
# w pliku został jeszcze placeholder.
case "${JWT_SECRET:-}" in
  ""|do-uzupelnienia-przy-deployu|zmien-mnie-na-losowy-64-hex)
    JWT_SECRET="$(openssl rand -hex 32)"
    echo "JWT_SECRET: wygenerowany losowo";;
  *) echo "JWT_SECRET: wzięty z pliku";;
esac

for zmienna in DATABASE_URL DIRECT_URL JWT_SECRET PLATFORM_URL; do
  wartosc="${!zmienna:-}"
  if [ -z "$wartosc" ]; then echo "$zmienna: PUSTE — pomijam"; continue; fi
  # usunięcie starej wartości (gdy jest) i wpisanie nowej
  vercel env rm "$zmienna" production --yes >/dev/null 2>&1 || true
  printf '%s' "$wartosc" | vercel env add "$zmienna" production >/dev/null 2>&1
  echo "$zmienna: ustawione"
done

echo
echo "Gotowe. Teraz mogę promować deploy na produkcję."
