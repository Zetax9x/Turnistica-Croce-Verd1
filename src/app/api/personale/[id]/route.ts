import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB();
    const db = getDB();
    const { nome, ruolo, attivo } = await req.json();
    await db.execute({
      sql: `UPDATE personale SET nome=?, ruolo=?, attivo=? WHERE id=?`,
      args: [nome, ruolo, attivo ?? 1, params.id],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initDB();
    const db = getDB();
    // Rimuoviamo il personale dai turni prima di eliminarlo
    await db.execute({ sql: `UPDATE turni SET personale_id=NULL WHERE personale_id=?`, args: [params.id] });
    await db.execute({ sql: `UPDATE programmati SET personale_id=NULL WHERE personale_id=?`, args: [params.id] });
    await db.execute({ sql: `DELETE FROM personale WHERE id=?`, args: [params.id] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
