import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';
import { getDayDate, toISO } from '@/lib/utils';
import { FASCIA_ORE } from '@/lib/types';

/**
 * GET /api/report?anno=2025&mese=5&personale_id=3
 *
 * Regola aggregazione:
 *   • Mattino + Pomeriggio stesso giorno stessa postazione → una riga "Giornata (08–20)"
 *   • Altrimenti ogni turno è una riga separata
 *   • I Programmati restano sempre righe indipendenti
 */
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const anno        = Number(searchParams.get('anno'));
    const mese        = Number(searchParams.get('mese'));
    const personale_id = searchParams.get('personale_id');

    if (!anno || !mese || !personale_id)
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });

    const inizioMese = new Date(anno, mese - 1, 1);
    const fineMese   = new Date(anno, mese,     0);

    // ── Turni standard ────────────────────────────────────────────
    const turniRes = await db.execute({
      sql: `SELECT t.settimana, t.postazione, t.giorno, t.fascia, t.ruolo
            FROM turni t
            WHERE t.personale_id = ?
            ORDER BY t.settimana, t.giorno, t.fascia`,
      args: [personale_id],
    });

    // Raggruppa per (data, postazione) per individuare le giornate intere
    type TurnoRaw = { data: string; postazione: string; fascia: string; ruolo: string };
    const perGiornoPostazione = new Map<string, TurnoRaw[]>();

    for (const r of turniRes.rows) {
      const data = getDayDate(r.settimana as string, r.giorno as number);
      if (data < inizioMese || data > fineMese) continue;
      const key = `${toISO(data)}|${r.postazione}`;
      if (!perGiornoPostazione.has(key)) perGiornoPostazione.set(key, []);
      perGiornoPostazione.get(key)!.push({
        data:      toISO(data),
        postazione: r.postazione as string,
        fascia:    r.fascia as string,
        ruolo:     r.ruolo as string,
      });
    }

    // Costruisce le righe finali con aggregazione mattino+pomeriggio
    const rows: Record<string, unknown>[] = [];

    for (const turniGiorno of Array.from(perGiornoPostazione.values())) {
      const hasMattino   = turniGiorno.some(t => t.fascia === 'mattino');
      const hasPomeriggio = turniGiorno.some(t => t.fascia === 'pomeriggio');
      const hasNotte     = turniGiorno.some(t => t.fascia === 'notte');
      const { data, postazione } = turniGiorno[0];

      // Il ruolo coperto è quello del primo turno trovato (dovrebbe essere coerente)
      const ruoloCoperto = turniGiorno[0].ruolo;

      if (hasMattino && hasPomeriggio) {
        // ► Giornata intera (mattino + pomeriggio fusi)
        rows.push({
          data,
          postazione,
          fascia:       'giornata',
          orario:       '08:00 – 20:00',
          ore:          12,
          ruolo_coperto: ruoloCoperto,
          tipo:         'standard',
        });
      } else if (hasMattino) {
        rows.push({ data, postazione, fascia: 'mattino', orario: '08:00 – 14:00', ore: FASCIA_ORE.mattino, ruolo_coperto: ruoloCoperto, tipo: 'standard' });
      } else if (hasPomeriggio) {
        rows.push({ data, postazione, fascia: 'pomeriggio', orario: '14:00 – 20:00', ore: FASCIA_ORE.pomeriggio, ruolo_coperto: ruoloCoperto, tipo: 'standard' });
      }

      // La notte è sempre una riga separata (se presente)
      if (hasNotte) {
        rows.push({ data, postazione, fascia: 'notte', orario: '20:00 – 08:00', ore: FASCIA_ORE.notte, ruolo_coperto: ruoloCoperto, tipo: 'standard' });
      }
    }

    // ── Programmati ───────────────────────────────────────────────
    const progRes = await db.execute({
      sql: `SELECT settimana, giorno, ora_inizio, ora_fine,
                   COALESCE(postazione, 'programmati') AS postazione
            FROM programmati
            WHERE personale_id = ?
            ORDER BY settimana, giorno`,
      args: [personale_id],
    });

    for (const r of progRes.rows) {
      const data = getDayDate(r.settimana as string, r.giorno as number);
      if (data < inizioMese || data > fineMese) continue;
      const inizio = r.ora_inizio as string | null;
      const fine   = r.ora_fine  as string | null;
      let ore = 0;
      if (inizio && fine) {
        const [hi, mi] = inizio.split(':').map(Number);
        const [hf, mf] = fine.split(':').map(Number);
        let minuti = (hf * 60 + mf) - (hi * 60 + mi);
        if (minuti < 0) minuti += 24 * 60;
        ore = Math.round((minuti / 60) * 10) / 10;
      }
      rows.push({
        data:          toISO(data),
        postazione:    r.postazione as string,   // 'programmati' o 'altro'
        fascia:        null,
        orario:        inizio && fine ? `${inizio} – ${fine}` : '–',
        ore,
        ruolo_coperto: null,
        tipo:          'programmato',
      });
    }

    // Ordina per data
    rows.sort((a, b) => (a.data as string).localeCompare(b.data as string));

    const totale_ore = Math.round(rows.reduce((sum, r) => sum + (r.ore as number), 0) * 10) / 10;

    return NextResponse.json({ righe: rows, totale_ore });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
