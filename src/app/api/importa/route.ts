import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';
import { parseWordBuffer } from '@/lib/importParser';
import { matchName, type PersonaleLite } from '@/lib/nameMatch';

export const runtime = 'nodejs';

// ─── POST /api/importa — carica file Word, restituisce anteprima con matching ──

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();

    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0)
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 });

    // Personale registrato (per il matching)
    const res = await db.execute('SELECT id, nome, ruolo, attivo FROM personale WHERE attivo = 1');
    const personale: PersonaleLite[] = res.rows.map(r => ({
      id: Number(r.id),
      nome: String(r.nome),
      ruolo: r.ruolo as 'autista' | 'soccorritore',
      attivo: Number(r.attivo),
    }));

    const result = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      let parsed;
      try {
        parsed = await parseWordBuffer(buf, file.name);
      } catch (e) {
        console.error('Errore parsing', file.name, e);
        result.push({
          filename: file.name,
          postazione: null,
          ruolo: null,
          cells: [],
          namesCount: 0,
          warning: 'Impossibile leggere il file (formato non valido o danneggiato).',
        });
        continue;
      }

      const cells = parsed.cells.map(c => ({
        ...c,
        match: matchName(c.raw, personale, parsed.ruolo),
      }));

      result.push({ ...parsed, cells });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
