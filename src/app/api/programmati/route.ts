import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/**
 * GET /api/programmati?settimana=YYYY-MM-DD&postazione=programmati
 * Filtra per postazione (default 'programmati' se non specificata).
 */
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const params      = new URL(req.url).searchParams;
    const settimana   = params.get('settimana');
    const postazione  = params.get('postazione') ?? 'programmati';

    if (!settimana) return NextResponse.json({ error: 'Parametro mancante' }, { status: 400 });

    const result = await db.execute({
      sql: `SELECT pr.id, pr.settimana, pr.postazione, pr.giorno,
                   pr.ora_inizio, pr.ora_fine,
                   pr.personale_id, pr.volontario,
                   p.nome AS personale_nome
            FROM programmati pr
            LEFT JOIN personale p ON pr.personale_id = p.id
            WHERE pr.settimana = ?
              AND (pr.postazione = ? OR (pr.postazione IS NULL AND ? = 'programmati'))
            ORDER BY pr.giorno, pr.ora_inizio`,
      args: [settimana, postazione, postazione],
    });
    return NextResponse.json(result.rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/** POST /api/programmati — nuovo slot */
export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { settimana, postazione, giorno, ora_inizio, ora_fine, personale_id, volontario } = await req.json();

    if (!settimana || !giorno) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO programmati (settimana, postazione, giorno, ora_inizio, ora_fine, personale_id, volontario)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        settimana,
        postazione ?? 'programmati',
        giorno,
        ora_inizio  ?? null,
        ora_fine    ?? null,
        personale_id ?? null,
        volontario  ?? null,
      ],
    });
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
