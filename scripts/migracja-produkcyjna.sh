#!/usr/bin/env bash
# Migracja produkcyjna: blob KV w Supabase → tabele Postgresa.
#
# Sekrety czyta z backend/.env — NIE podawaj ich w argumentach ani w historii
# powłoki. Skrypt niczego nie wypisuje poza raportem liczności.
#
#   1. uzupełnij backend/.env.produkcja (patrz backend/.env.example)
#      — osobny plik, żeby nie nadpisywać lokalnego .env z bazą deweloperską
#   2. ./scripts/migracja-produkcyjna.sh --dry-run    # próba, zero zapisów
#   3. ./scripts/migracja-produkcyjna.sh              # właściwa migracja
set -euo pipefail

cd "$(dirname "$0")/.."
# Produkcyjne sekrety trzymamy OSOBNO od lokalnego .env, żeby jedno nie
# nadpisywało drugiego. Oba są w .gitignore i .vercelignore.
ENV_FILE="${PP_ENV_FILE:-backend/.env.produkcja}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Brak $ENV_FILE."
  echo "Zrób: cp backend/.env.example backend/.env.produkcja — i uzupełnij:"
  echo "  DATABASE_URL, DIRECT_URL (hasło z Supabase → Settings → Database)"
  echo "  SUPABASE_URL, SUPABASE_KEY (klucz service_role, ten sam co w Renderze)"
  exit 1
fi

set -a; . "$ENV_FILE"; set +a

brakuje=()
for zmienna in DATABASE_URL DIRECT_URL SUPABASE_URL SUPABASE_KEY; do
  [ -n "${!zmienna:-}" ] || brakuje+=("$zmienna")
done
if [ ${#brakuje[@]} -gt 0 ]; then
  echo "Brakuje w $ENV_FILE: ${brakuje[*]}"
  exit 1
fi

# Zabezpieczenie przed najgorszą pomyłką: puszczeniem migracji na lokalną bazę.
case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo "DATABASE_URL wskazuje na lokalną bazę. To ma jechać na Supabase — przerywam."
    exit 1;;
esac

DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN="--dry-run"

echo "== 1/3 Schemat: prisma migrate deploy =="
( cd backend && npx prisma migrate deploy )

echo
echo "== 2/3 Dane: migrate-kv ${DRY_RUN:-(zapis)} =="
if [ -z "$DRY_RUN" ]; then
  echo "To ZAPISZE dane do Postgresa. Uprzedź ekipę, żeby przez chwilę nie zapisywała gierek."
  printf "Kontynuować? [wpisz tak]: "
  read -r odp
  [ "$odp" = "tak" ] || { echo "Przerwane."; exit 1; }
fi
( cd backend && npx tsx src/scripts/migrate-kv.ts $DRY_RUN )

echo
echo "== 3/3 Weryfikacja =="
if [ -n "$DRY_RUN" ]; then
  echo "Próba na sucho — porównaj liczby powyżej ze stanem bloba."
  echo "Stary backend (users): $(curl -s -m 60 https://padelparty.onrender.com/healthz || echo '[brak odpowiedzi]')"
else
  ( cd backend && npx tsx -e "
import { prisma } from './src/db';
(async () => {
  const [g, k, gr, p, t] = await Promise.all([
    prisma.player.count(), prisma.account.count(), prisma.game.count(),
    prisma.partyGroup.count(), prisma.tournament.count(),
  ]);
  console.log('  gracze', g, '| konta', k, '| gierki', gr, '| party', p, '| turnieje', t);
  await prisma.\$disconnect();
})();
" )
  echo
  echo "Zostało: ustawić DATABASE_URL i DIRECT_URL w zmiennych produkcyjnych Vercela."
fi
