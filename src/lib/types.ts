export type Ruolo = 'autista' | 'soccorritore';
export type Fascia = 'mattino' | 'pomeriggio' | 'notte';
export type TipoSettimana = 'A' | 'B';

export interface Personale {
  id: number;
  nome: string;
  ruolo: Ruolo;
  attivo: number;
}

export interface Turno {
  id: number;
  settimana: string;      // 'YYYY-MM-DD' (lunedì)
  postazione: string;
  giorno: number;         // 1=Lun … 7=Dom
  fascia: Fascia;
  ruolo: Ruolo;
  personale_id: number | null;
  personale_nome?: string;
  personale_ruolo?: string;
  volontario: string | null;
}

export interface Programmato {
  id: number;
  settimana: string;
  giorno: number;
  ora_inizio: string | null;
  ora_fine: string | null;
  personale_id: number | null;
  personale_nome?: string;
  volontario: string | null;
}

export const POSTAZIONI_A = ['ascoli', 'venarotta', 'acquasanta', 'altro'] as const;
export const POSTAZIONI_B = ['venarotta', 'acquasanta', 'programmati', 'standby', 'altro'] as const;

/** Postazioni con slot orari liberi (stessa UI di Programmati) */
export function isPostazioneLibera(postazione: string): boolean {
  return postazione === 'programmati' || postazione === 'altro';
}

export const FASCE: Fascia[] = ['mattino', 'pomeriggio', 'notte'];

export const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const GIORNI_LUNGHI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export const FASCIA_LABEL: Record<Fascia, string> = {
  mattino: 'Mattino',
  pomeriggio: 'Pomeriggio',
  notte: 'Notte',
};

export const FASCIA_ORARIO: Record<Fascia, string> = {
  mattino: '08:00 – 14:00',
  pomeriggio: '14:00 – 20:00',
  notte: '20:00 – 08:00',
};

export const FASCIA_ORE: Record<Fascia, number> = {
  mattino: 6,
  pomeriggio: 6,
  notte: 12,
};

export const POSTAZIONE_LABEL: Record<string, string> = {
  ascoli: 'Ascoli',
  venarotta: 'Venarotta',
  acquasanta: 'Acquasanta',
  standby: 'Standby',
  programmati: 'Programmati',
  altro: 'Altro',
};
