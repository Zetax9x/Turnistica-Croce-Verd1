// ─── Matching nomi letti dai file ↔ personale registrato ──────────────────────
//
// I file riportano i COGNOMI in maiuscolo (a volte con refusi, es. SPATATO).
// Il personale è registrato col cognome (es. "Spataro") o cognome + iniziale
// (es. "Agostini J."). Confrontiamo il cognome normalizzato; con piccola
// tolleranza ai refusi (distanza di Levenshtein) proponiamo comunque un match,
// segnalandolo come "da verificare". Se nessuno corrisponde → volontario.

export type Ruolo = 'autista' | 'soccorritore';

export interface PersonaleLite {
  id: number;
  nome: string;
  ruolo: Ruolo;
  attivo: number;
}

export type MatchType = 'exact' | 'fuzzy' | 'volontario';

export interface NameMatch {
  type: MatchType;
  personale_id: number | null;
  personale_nome: string | null;
  volontario: string | null;
  distance?: number;
}

/** Rimuove gli accenti (è → e) */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** MAIUSCOLO senza accenti né punteggiatura, spazi singoli */
export function normalizeName(s: string): string {
  return stripAccents(s)
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prima parola normalizzata: "Agostini J." → "AGOSTINI" */
export function surnameKey(nome: string): string {
  return normalizeName(nome).split(' ')[0] ?? '';
}

/** "JONATHAN" → "Jonathan" (per i volontari) */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase());
}

/** Distanza di Levenshtein fra due stringhe */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Abbina un cognome letto dal file al personale.
 * @param ruolo ruolo del foglio: 'autista' → solo autisti; altrimenti tutti
 *              (un autista può fare anche il soccorritore).
 */
export function matchName(
  raw: string,
  personale: PersonaleLite[],
  ruolo: Ruolo | null,
): NameMatch {
  const T = normalizeName(raw);
  const pool = personale.filter(
    p => p.attivo && (ruolo === 'autista' ? p.ruolo === 'autista' : true),
  );

  // 1. Match esatto sul cognome
  const exact = pool.filter(p => surnameKey(p.nome) === T);
  if (exact.length >= 1) {
    const pick = exact[0];
    return { type: 'exact', personale_id: pick.id, personale_nome: pick.nome, volontario: null };
  }

  // 2. Match approssimativo (refusi)
  let best: PersonaleLite | null = null;
  let bestD = Infinity;
  for (const p of pool) {
    const d = levenshtein(T, surnameKey(p.nome));
    if (d < bestD) { bestD = d; best = p; }
  }
  const threshold = T.length <= 5 ? 1 : 2;
  if (best && bestD <= threshold) {
    return {
      type: 'fuzzy',
      personale_id: best.id,
      personale_nome: best.nome,
      volontario: null,
      distance: bestD,
    };
  }

  // 3. Nessun match → volontario
  return { type: 'volontario', personale_id: null, personale_nome: null, volontario: titleCase(raw) };
}
