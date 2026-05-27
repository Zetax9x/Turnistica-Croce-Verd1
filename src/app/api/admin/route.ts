import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/** GET /api/admin  →  { ref_settimana: string|null, ref_tipo: 'A'|'B'|null } */
export async function GET() {
  try {
    await initDB();
    const db = getDB();
    const res = await db.execute(
      `SELECT chiave, valore FROM impostazioni WHERE chiave IN ('ref_settimana','ref_tipo')`
    );
    const map: Record<string, string> = {};
    for (const r of res.rows) map[r.chiave as string] = r.valore as string;
    return NextResponse.json({
      ref_settimana: map['ref_settimana'] ?? null,
      ref_tipo:      map['ref_tipo']      ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/** POST /api/admin  body: { ref_settimana: 'YYYY-MM-DD', ref_tipo: 'A'|'B' } */
export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { ref_settimana, ref_tipo } = await req.json();

    if (!ref_settimana || !['A', 'B'].includes(ref_tipo)) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }

    await db.batch([
      {
        sql: `INSERT INTO impostazioni (chiave, valore) VALUES ('ref_settimana', ?)
              ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`,
        args: [ref_settimana],
      },
      {
        sql: `INSERT INTO impostazioni (chiave, valore) VALUES ('ref_tipo', ?)
              ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore`,
        args: [ref_tipo],
      },
    ], 'write');

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
