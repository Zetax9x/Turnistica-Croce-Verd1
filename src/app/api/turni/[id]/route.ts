import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

/** DELETE /api/turni/[id] — svuota un turno */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB();
    const db = getDB();
    await db.execute({ sql: `DELETE FROM turni WHERE id=?`, args: [params.id] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
