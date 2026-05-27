import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/** PUT /api/programmati/[id] — aggiorna slot */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB();
    const db = getDB();
    const { ora_inizio, ora_fine, personale_id, volontario } = await req.json();
    await db.execute({
      sql: `UPDATE programmati SET ora_inizio=?, ora_fine=?, personale_id=?, volontario=? WHERE id=?`,
      args: [ora_inizio ?? null, ora_fine ?? null, personale_id ?? null, volontario ?? null, params.id],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

/** DELETE /api/programmati/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB();
    const db = getDB();
    await db.execute({ sql: `DELETE FROM programmati WHERE id=?`, args: [params.id] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
