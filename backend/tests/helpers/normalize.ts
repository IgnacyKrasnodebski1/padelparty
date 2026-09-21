/**
 * Sprowadza odpowiedź do postaci porównywalnej między starym a nowym backendem.
 * Bez tego każdy test failuje na losowości: id, tokeny, znaczniki czasu i kody
 * party są inne przy każdym uruchomieniu.
 *
 * Id-ki mapujemy przez kolejność pierwszego wystąpienia (`<id1>`, `<id2>`, …),
 * więc porównujemy GRAF powiązań, a nie konkretne wartości: jeśli u obu stron
 * `aIds[0]` wskazuje na tego samego (w kolejności) gracza, wyjdzie tak samo.
 */
const LEGACY_ID = /^(?:p|u|g|pt|t)[0-9a-f]{10}$/;
const CUID = /^c[a-z0-9]{20,}$/;
const TOKEN = /^[0-9a-f]{48}$/;
const PARTY_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;
const TIME_KEYS = new Set(['ts', 'createdAt']);

export function createNormalizer(): (value: unknown, key?: string) => unknown {
  const ids = new Map<string, string>();

  const mapId = (raw: string): string => {
    const seen = ids.get(raw);
    if (seen) return seen;
    const placeholder = `<id${ids.size + 1}>`;
    ids.set(raw, placeholder);
    return placeholder;
  };

  const walk = (value: unknown, key?: string): unknown => {
    if (Array.isArray(value)) return value.map((v) => walk(v, key));

    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = walk(v, k);
      }
      return out;
    }

    if (typeof value === 'number' && key !== undefined && TIME_KEYS.has(key)) return '<ts>';

    if (typeof value === 'string') {
      if (TOKEN.test(value)) return '<token>';
      if (LEGACY_ID.test(value) || CUID.test(value)) return mapId(value);
      if (key === 'code' && PARTY_CODE.test(value)) return '<code>';
    }

    return value;
  };

  return walk;
}

/**
 * Kolejność tablicy `games` jest udokumentowanym odstępstwem (legacy dokładało
 * gry turniejowe na koniec, my zwracamy je w kolejności `ts`), więc przed
 * porównaniem sortujemy ją po treści. Pozostałe kolekcje porównujemy w kolejności.
 */
export function sortGames(body: unknown): unknown {
  if (body === null || typeof body !== 'object') return body;

  const root = body as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  if (!data || !Array.isArray(data.games)) return body;

  const games = [...data.games].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { ...root, data: { ...data, games } };
}
