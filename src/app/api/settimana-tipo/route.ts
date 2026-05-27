import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';
import { getWeekType, computeWeekTypeFromRef, getMondayOfWeek, toISO, fromISO } from '@/lib/utils';
import type { TipoSettimana } from '@/lib/types';

/**
 * GET /api/settimana-tipo?settimana=YYYY-MM-DD
 *
 * Restituisce { tipo: 'A'|'B' } per la settimana richiesta.
 * Se esiste un riferimento manuale in DB lo usa, altrimenti usa
 * il calcolo automatico (ISO week pari/dispari).
 */
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const settimana = new URL(req.url).searchParams.get('settimana');

    if (!settimana)
      return NextResponse.json({ error: 'Parametro mancante' }, { status: 400 });

    // Normalizza al lunedì della settimana
    const lunedi = toISO(getMondayOfWeek(fromISO(settimana)));

    // Leggi impostazioni
    const res = await db.execute(
      `SELECT chiave, valore FROM impostazioni WHERE chiave IN ('ref_settimana','ref_tipo')`
    );
    const map: Record<string, string> = {};
    for (const r of res.rows) map[r.chiave as string] = r.valore as string;

    let tipo: TipoSettimana;

    if (map['ref_settimana'] && map['ref_tipo']) {
      tipo = computeWeekTypeFromRef(lunedi, map['ref_settimana'], map['ref_tipo'] as TipoSettimana);
    } else {
      tipo = getWeekType(fromISO(lunedi));
    }

    return NextResponse.json({ tipo, lunedi });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
