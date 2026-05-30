import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/**
 * GET /api/panoramica?settimana=YYYY-MM-DD
 *
 * Restituisce il riepilogo ore di tutto il personale per la settimana indicata.
 * Regole:
 *   • Mattino (6h) + Pomeriggio (6h) stesso giorno stessa postazione → Giornata (12h)
 *   • Notte = 12h sempre separata
 *   • Programmati/Altro: ore calcolate da ora_inizio–ora_fine
 *   • Solo personale registrato — i volontari esterni sono esclusi
 */
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const settimana = searchParams.get('settimana');

    if (!settimana)
      return NextResponse.json({ error: 'Parametro settimana mancante' }, { status: 400 });

    // ── Turni standard ────────────────────────────────────────────────────────
    const turniRes = await db.execute({
      sql: `SELECT t.personale_id, t.volontario, t.giorno, t.postazione, t.fascia,
                   p.nome, p.ruolo
            FROM turni t
            JOIN personale p ON t.personale_id = p.id
            WHERE t.settimana = ?
              AND t.personale_id IS NOT NULL
            ORDER BY t.giorno, t.fascia`,
      args: [settimana],
    });

    // Mappa: key → { nome, ruolo, ore, turni[] }
    type PersonEntry = {
      nome: string;
      ruolo: string;
      ore: number;
      nTurni: number;
      isVolontario: boolean;
    };

    const mappa = new Map<string, PersonEntry>();

    const getKey = (pid: number | null, vol: string | null) =>
      pid ? `p:${pid}` : `v:${vol}`;

    const getOrCreate = (pid: number | null, vol: string | null, nome: string, ruolo: string, isVol: boolean) => {
      const k = getKey(pid, vol);
      if (!mappa.has(k)) mappa.set(k, { nome, ruolo, ore: 0, nTurni: 0, isVolontario: isVol });
      return mappa.get(k)!;
    };

    // Per calcolare mattino+pomeriggio fusion, raggruppiamo per (chiave persona, giorno, postazione)
    type SlotKey = string;
    const fascePerSlot = new Map<SlotKey, Set<string>>();
    const slotPersona = new Map<SlotKey, { pid: number | null; vol: string | null; nome: string; ruolo: string; isVol: boolean }>();

    for (const r of turniRes.rows) {
      const pid    = r.personale_id as number | null;
      const vol    = r.volontario as string | null;
      const nome   = (r.nome as string) ?? (vol ?? 'Volontario');
      const ruolo  = (r.ruolo as string) ?? '–';
      const isVol  = !pid;
      const giorno = r.giorno as number;
      const post   = r.postazione as string;
      const fascia = r.fascia as string;

      const personKey = getKey(pid, vol);
      const slotKey: SlotKey = `${personKey}|${giorno}|${post}`;

      if (!fascePerSlot.has(slotKey)) {
        fascePerSlot.set(slotKey, new Set());
        slotPersona.set(slotKey, { pid, vol, nome, ruolo, isVol });
      }
      fascePerSlot.get(slotKey)!.add(fascia);
    }

    // Ora calcola le ore per ogni slot
    for (const [slotKey, fasce] of Array.from(fascePerSlot.entries())) {
      const { pid, vol, nome, ruolo, isVol } = slotPersona.get(slotKey)!;
      const entry = getOrCreate(pid, vol, nome, ruolo, isVol);

      if (fasce.has('mattino') && fasce.has('pomeriggio')) {
        // Giornata intera: 12h, conta come 1 "turno giornata"
        entry.ore += 12;
        entry.nTurni += 1;
      } else {
        if (fasce.has('mattino'))    { entry.ore += 6;  entry.nTurni += 1; }
        if (fasce.has('pomeriggio')) { entry.ore += 6;  entry.nTurni += 1; }
      }
      if (fasce.has('notte')) { entry.ore += 12; entry.nTurni += 1; }
    }

    // ── Programmati / Altro ───────────────────────────────────────────────────
    const progRes = await db.execute({
      sql: `SELECT pr.personale_id, pr.volontario, pr.ora_inizio, pr.ora_fine,
                   p.nome, p.ruolo
            FROM programmati pr
            JOIN personale p ON pr.personale_id = p.id
            WHERE pr.settimana = ?
              AND pr.personale_id IS NOT NULL`,
      args: [settimana],
    });

    for (const r of progRes.rows) {
      const pid    = r.personale_id as number | null;
      const vol    = r.volontario as string | null;
      const nome   = (r.nome as string) ?? (vol ?? 'Volontario');
      const ruolo  = (r.ruolo as string) ?? '–';
      const isVol  = !pid;

      const inizio = r.ora_inizio as string | null;
      const fine   = r.ora_fine as string | null;
      let ore = 0;
      if (inizio && fine) {
        const [hi, mi] = inizio.split(':').map(Number);
        const [hf, mf] = fine.split(':').map(Number);
        let minuti = (hf * 60 + mf) - (hi * 60 + mi);
        if (minuti < 0) minuti += 24 * 60;
        ore = Math.round((minuti / 60) * 10) / 10;
      }

      const entry = getOrCreate(pid, vol, nome, ruolo, isVol);
      entry.ore    = Math.round((entry.ore + ore) * 10) / 10;
      entry.nTurni += 1;
    }

    // Costruisce la risposta, ordinata per ore desc poi per nome
    const risultato = Array.from(mappa.entries())
      .map(([, v]) => v)
      .sort((a, b) => b.ore - a.ore || a.nome.localeCompare(b.nome, 'it'));

    return NextResponse.json(risultato);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
