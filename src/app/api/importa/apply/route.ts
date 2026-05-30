import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export const runtime = 'nodejs';

interface ApplyItem {
  postazione: string;
  ruolo: 'autista' | 'soccorritore';
  giorno: number;
  fascia: 'mattino' | 'pomeriggio' | 'notte';
  personale_id: number | null;
  volontario: string | null;
}

// ─── POST /api/importa/apply — scrive i turni confermati sul tabellone ─────────
//
// skipFilled (default true): non tocca le caselle che hanno già un valore.

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();

    const body = await req.json();
    const settimana: string = body.settimana;
    const items: ApplyItem[] = Array.isArray(body.items) ? body.items : [];
    const skipFilled: boolean = body.skipFilled !== false;

    if (!settimana || items.length === 0)
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

    let inseriti = 0;
    let saltati = 0;
    let ignorati = 0;

    for (const it of items) {
      // Niente da inserire
      if (!it.personale_id && !it.volontario) { ignorati++; continue; }
      if (!it.postazione || !it.ruolo || !it.giorno || !it.fascia) { ignorati++; continue; }

      if (skipFilled) {
        const ex = await db.execute({
          sql: `SELECT personale_id, volontario FROM turni
                WHERE settimana=? AND postazione=? AND giorno=? AND fascia=? AND ruolo=?`,
          args: [settimana, it.postazione, it.giorno, it.fascia, it.ruolo],
        });
        if (ex.rows.length > 0 && (ex.rows[0].personale_id != null || ex.rows[0].volontario != null)) {
          saltati++;
          continue;
        }
      }

      await db.execute({
        sql: `INSERT INTO turni (settimana, postazione, giorno, fascia, ruolo, personale_id, volontario)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(settimana, postazione, giorno, fascia, ruolo)
              DO UPDATE SET personale_id=excluded.personale_id, volontario=excluded.volontario`,
        args: [settimana, it.postazione, it.giorno, it.fascia, it.ruolo, it.personale_id ?? null, it.volontario ?? null],
      });
      inseriti++;
    }

    return NextResponse.json({ inseriti, saltati, ignorati });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
