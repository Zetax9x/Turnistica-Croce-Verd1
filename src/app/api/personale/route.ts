import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    const db = getDB();
    const result = await db.execute(
      `SELECT id, nome, ruolo, attivo FROM personale ORDER BY ruolo, nome`
    );
    return NextResponse.json(result.rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { nome, ruolo } = await req.json();
    if (!nome?.trim() || !['autista', 'soccorritore'].includes(ruolo)) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });
    }
    const result = await db.execute({
      sql: `INSERT INTO personale (nome, ruolo) VALUES (?, ?) RETURNING id, nome, ruolo, attivo`,
      args: [nome.trim(), ruolo],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
