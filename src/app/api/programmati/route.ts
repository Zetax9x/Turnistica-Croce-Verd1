import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/** GET /api/programmati?settimana=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const settimana = new URL(req.url).searchParams.get('settimana');
    if (!settimana) return NextResponse.json({ error: 'Parametro mancante' }, { status: 400 });

    const result = await db.execute({
      sql: `SELECT pr.id, pr.settimana, pr.giorno, pr.ora_inizio, pr.ora_fine,
                   pr.personale_id, pr.volontario,
                   p.nome AS personale_nome
            FROM programmati pr
            LEFT JOIN personale p ON pr.personale_id = p.id
            WHERE pr.settimana = ?
            ORDER BY pr.giorno, pr.ora_inizio`,
      args: [settimana],
    });
    return NextResponse.json(result.rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/** POST /api/programmati — nuovo slot programmato */
export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { settimana, giorno, ora_inizio, ora_fine, personale_id, volontario } = await req.json();

    if (!settimana || !giorno) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO programmati (settimana, giorno, ora_inizio, ora_fine, personale_id, volontario)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [settimana, giorno, ora_inizio ?? null, ora_fine ?? null, personale_id ?? null, volontario ?? null],
    });
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
