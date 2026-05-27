import { NextRequest, NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';
import type { Client } from '@libsql/client';

// ─── Helper: aggiunge/toglie giorni a una stringa YYYY-MM-DD ─────────────────

function shiftDate(settimana: string, giorni: number): string {
  const [y, m, d] = settimana.split('-').map(Number);
  const date = new Date(y, m - 1, d + giorni);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// ─── Controllo conflitti ──────────────────────────────────────────────────────

async function checkConflicts(
  db: Client,
  settimana: string,
  postazione: string,
  giorno: number,
  fascia: string,
  ruolo: string,
  personale_id: number,
): Promise<string | null> {

  // 1. Stessa fascia oraria, postazione o ruolo diverso
  const sameSlot = await db.execute({
    sql: `SELECT postazione, ruolo FROM turni
          WHERE settimana=? AND giorno=? AND fascia=? AND personale_id=?
            AND NOT (postazione=? AND ruolo=?)`,
    args: [settimana, giorno, fascia, personale_id, postazione, ruolo],
  });
  if (sameSlot.rows.length > 0) {
    const r = sameSlot.rows[0];
    return `Conflitto: già assegnato a "${r.postazione}" come ${r.ruolo} nello stesso turno`;
  }

  // 2. Pomeriggio + Notte nello stesso giorno (turni adiacenti)
  if (fascia === 'notte') {
    const hasPom = await db.execute({
      sql: `SELECT id FROM turni WHERE settimana=? AND giorno=? AND fascia='pomeriggio' AND personale_id=?`,
      args: [settimana, giorno, personale_id],
    });
    if (hasPom.rows.length > 0)
      return 'Conflitto: ha già il turno Pomeriggio (14–20) — non può fare Notte (20–08) nello stesso giorno';
  }

  if (fascia === 'pomeriggio') {
    const hasNot = await db.execute({
      sql: `SELECT id FROM turni WHERE settimana=? AND giorno=? AND fascia='notte' AND personale_id=?`,
      args: [settimana, giorno, personale_id],
    });
    if (hasNot.rows.length > 0)
      return 'Conflitto: ha già il turno Notte (20–08) — non può fare Pomeriggio (14–20) nello stesso giorno';
  }

  // 3. Notte del giorno X → non può fare Mattino del giorno X+1
  if (fascia === 'notte') {
    const nextDay   = giorno < 7 ? giorno + 1 : 1;
    const nextWeek  = giorno < 7 ? settimana : shiftDate(settimana, 7);
    const hasMat = await db.execute({
      sql: `SELECT id FROM turni WHERE settimana=? AND giorno=? AND fascia='mattino' AND personale_id=?`,
      args: [nextWeek, nextDay, personale_id],
    });
    if (hasMat.rows.length > 0)
      return 'Conflitto: ha già il turno Mattino (08–14) il giorno successivo — non compatibile con la Notte';
  }

  // 4. Mattino del giorno X → non può fare Notte del giorno X-1
  if (fascia === 'mattino') {
    const prevDay  = giorno > 1 ? giorno - 1 : 7;
    const prevWeek = giorno > 1 ? settimana : shiftDate(settimana, -7);
    const hasNot = await db.execute({
      sql: `SELECT id FROM turni WHERE settimana=? AND giorno=? AND fascia='notte' AND personale_id=?`,
      args: [prevWeek, prevDay, personale_id],
    });
    if (hasNot.rows.length > 0)
      return 'Conflitto: ha il turno Notte (20–08) nel giorno precedente — non può fare Mattino (08–14)';
  }

  return null;
}

// ─── GET /api/turni?settimana=YYYY-MM-DD&postazione=xxx ──────────────────────

export async function GET(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const { searchParams } = new URL(req.url);
    const settimana  = searchParams.get('settimana');
    const postazione = searchParams.get('postazione');

    if (!settimana || !postazione)
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });

    const result = await db.execute({
      sql: `SELECT t.id, t.settimana, t.postazione, t.giorno, t.fascia, t.ruolo,
                   t.personale_id, t.volontario,
                   p.nome AS personale_nome, p.ruolo AS personale_ruolo
            FROM turni t
            LEFT JOIN personale p ON t.personale_id = p.id
            WHERE t.settimana = ? AND t.postazione = ?
            ORDER BY t.giorno, t.fascia, t.ruolo`,
      args: [settimana, postazione],
    });
    return NextResponse.json(result.rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST /api/turni — crea o aggiorna (upsert) un turno ────────────────────

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const db = getDB();
    const body = await req.json();
    const { settimana, postazione, giorno, fascia, ruolo, personale_id, volontario } = body;

    if (!settimana || !postazione || !giorno || !fascia || !ruolo)
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 });

    // ── Controllo conflitti (solo per personale registrato) ──
    if (personale_id) {
      const conflitto = await checkConflicts(db, settimana, postazione, giorno, fascia, ruolo, personale_id);
      if (conflitto)
        return NextResponse.json({ error: conflitto }, { status: 409 });
    }

    // ── Upsert ───────────────────────────────────────────────
    await db.execute({
      sql: `INSERT INTO turni (settimana, postazione, giorno, fascia, ruolo, personale_id, volontario)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(settimana, postazione, giorno, fascia, ruolo)
            DO UPDATE SET personale_id=excluded.personale_id, volontario=excluded.volontario`,
      args: [settimana, postazione, giorno, fascia, ruolo, personale_id ?? null, volontario ?? null],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
