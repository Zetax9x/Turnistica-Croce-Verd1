// ─── Parsing dei file Word con i turni ────────────────────────────────────────
//
// Ogni file (.doc o .docx) contiene UNA tabella:
//   riga 1 = intestazione giorni (Lun 01 … Dom 07)
//   riga 2 = Mattino, riga 3 = Pomeriggio, riga 4 = Notte
//   14 colonne = 7 giorni × [orario, cognome]
//
// Gli orari sono pieni di refusi e inutili: la fascia la dà la posizione della
// riga. Estraiamo quindi, in ordine di lettura, i cognomi (token TUTTI in
// maiuscolo di 3+ lettere) → 21 nomi = 7 giorni × 3 fasce.

import WordExtractor from 'word-extractor';
import { FASCE, type Fascia } from './types';
import { stripAccents } from './nameMatch';

const WEEKDAYS = new Set([
  'LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI', 'SABATO', 'DOMENICA',
]);

/** Estrae i cognomi (token tutti-maiuscoli, esclusi i nomi dei giorni) */
function extractNames(body: string): string[] {
  const tokens = body.match(/[A-Za-zÀ-ÿ'.]+/g) || [];
  const names: string[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/[.']/g, '');
    if (clean.length < 3) continue;
    if (clean !== clean.toUpperCase()) continue;       // deve essere tutto maiuscolo
    if (!/[A-ZÀ-Ý]/.test(clean)) continue;             // almeno una lettera
    if (WEEKDAYS.has(stripAccents(clean))) continue;   // non un giorno
    names.push(clean);
  }
  return names;
}

/** Deduce postazione e ruolo dal nome del file */
export function guessMeta(filename: string): {
  postazione: string | null;
  ruolo: 'autista' | 'soccorritore' | null;
} {
  const up = stripAccents(filename).toUpperCase();
  let postazione: string | null = null;
  if (up.includes('ASCOLI')) postazione = 'ascoli';
  else if (up.includes('VENAROTTA')) postazione = 'venarotta';
  else if (up.includes('ACQUASANTA')) postazione = 'acquasanta';

  let ruolo: 'autista' | 'soccorritore' | null = null;
  if (up.includes('AUTIST')) ruolo = 'autista';
  else if (up.includes('BARELLIER') || up.includes('SOCCORR')) ruolo = 'soccorritore';

  return { postazione, ruolo };
}

export interface ParsedCell {
  giorno: number;   // 1=Lun … 7=Dom
  fascia: Fascia;
  raw: string;      // cognome così come letto
}

export interface ParsedFile {
  filename: string;
  postazione: string | null;
  ruolo: 'autista' | 'soccorritore' | null;
  cells: ParsedCell[];
  namesCount: number;
  warning?: string;
}

/** Parsa un buffer Word (.doc/.docx) nelle celle giorno×fascia */
export async function parseWordBuffer(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const names = extractNames(doc.getBody());

  const cells: ParsedCell[] = [];
  for (let f = 0; f < FASCE.length; f++) {
    for (let d = 0; d < 7; d++) {
      const raw = names[f * 7 + d];
      if (raw) cells.push({ giorno: d + 1, fascia: FASCE[f], raw });
    }
  }

  const meta = guessMeta(filename);
  const warning = names.length !== 21
    ? `Letti ${names.length} nomi invece di 21 attesi — controlla l'allineamento giorno/fascia.`
    : undefined;

  return { filename, ...meta, cells, namesCount: names.length, warning };
}
