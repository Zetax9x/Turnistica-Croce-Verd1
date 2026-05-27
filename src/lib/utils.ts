import { TipoSettimana, POSTAZIONI_A, POSTAZIONI_B } from './types';

/** Numero settimana ISO (1–53) */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** Lunedì della settimana che contiene `date` */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Tipo settimana: settimane ISO dispari → A, pari → B */
export function getWeekType(mondayDate: Date): TipoSettimana {
  return getISOWeek(mondayDate) % 2 === 1 ? 'A' : 'B';
}

/** Postazioni disponibili per il tipo settimana */
export function getPostazioni(tipo: TipoSettimana): string[] {
  return tipo === 'A' ? [...POSTAZIONI_A] : [...POSTAZIONI_B];
}

/** Converte Date → 'YYYY-MM-DD' */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Crea Date da stringa 'YYYY-MM-DD' (locale) */
export function fromISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Data del giorno specifico della settimana (1=Lun) */
export function getDayDate(weekStart: string, dayOfWeek: number): Date {
  const monday = fromISO(weekStart);
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayOfWeek - 1);
  return d;
}

/** Formato italiano breve: '12/05/2025' */
export function formatDateIT(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/** Label settimana: 'Lun 12/05 – Dom 18/05/2025' */
export function getWeekLabel(mondayStr: string): string {
  const monday = fromISO(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
  const m = monday.toLocaleDateString('it-IT', opts);
  const s = sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${m} – ${s}`;
}

/** Calcola ore tra due orari HH:MM (gestisce mezzanotte) */
export function calcolaOre(inizio: string, fine: string): number {
  const [hi, mi] = inizio.split(':').map(Number);
  const [hf, mf] = fine.split(':').map(Number);
  let minuti = (hf * 60 + mf) - (hi * 60 + mi);
  if (minuti < 0) minuti += 24 * 60; // turno notturno oltre mezzanotte
  return Math.round((minuti / 60) * 10) / 10;
}

/**
 * Calcola il tipo settimana dato un punto di riferimento.
 * Se la distanza in settimane dal riferimento è pari → stesso tipo del riferimento.
 * Se dispari → tipo opposto.
 * Usato quando c'è un override manuale salvato in DB.
 */
export function computeWeekTypeFromRef(
  settimana: string,
  rifSett: string,
  rifTipo: TipoSettimana,
): TipoSettimana {
  const target = fromISO(settimana).getTime();
  const rif    = fromISO(rifSett).getTime();
  const diffWeeks = Math.round((target - rif) / (7 * 24 * 60 * 60 * 1000));
  // gestisce modulo negativo correttamente
  const isEven = ((diffWeeks % 2) + 2) % 2 === 0;
  return isEven ? rifTipo : (rifTipo === 'A' ? 'B' : 'A');
}

/** Aggiunge N settimane a una data ISO */
export function addWeeks(settimana: string, n: number): string {
  return toISO(new Date(fromISO(settimana).getTime() + n * 7 * 24 * 60 * 60 * 1000));
}

/** Mese in italiano */
export function getMeseLabel(anno: number, mese: number): string {
  return new Date(anno, mese - 1, 1).toLocaleDateString('it-IT', {
    month: 'long', year: 'numeric',
  });
}
