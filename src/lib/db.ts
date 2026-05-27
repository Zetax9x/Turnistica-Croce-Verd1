import { createClient } from '@libsql/client';

let _db: ReturnType<typeof createClient> | null = null;
let _initialized = false;

export function getDB() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('TURSO_DATABASE_URL non configurato');
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _db = createClient({
      url,
      // Passa il token solo se effettivamente valorizzato (non serve con file:local.db)
      ...(authToken ? { authToken } : {}),
    });
  }
  return _db;
}

export async function initDB() {
  if (_initialized) return;
  const db = getDB();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS personale (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nome      TEXT NOT NULL,
      ruolo     TEXT NOT NULL CHECK(ruolo IN ('autista','soccorritore')),
      attivo    INTEGER DEFAULT 1,
      creato_il TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS turni (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      settimana    TEXT    NOT NULL,
      postazione   TEXT    NOT NULL,
      giorno       INTEGER NOT NULL,
      fascia       TEXT    NOT NULL CHECK(fascia IN ('mattino','pomeriggio','notte')),
      ruolo        TEXT    NOT NULL CHECK(ruolo IN ('autista','soccorritore')),
      personale_id INTEGER REFERENCES personale(id) ON DELETE SET NULL,
      volontario   TEXT,
      UNIQUE(settimana, postazione, giorno, fascia, ruolo)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS programmati (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      settimana    TEXT    NOT NULL,
      giorno       INTEGER NOT NULL,
      ora_inizio   TEXT,
      ora_fine     TEXT,
      personale_id INTEGER REFERENCES personale(id) ON DELETE SET NULL,
      volontario   TEXT
    )
  `);

  // Tabella impostazioni generali (chiave→valore)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS impostazioni (
      chiave TEXT PRIMARY KEY,
      valore TEXT NOT NULL
    )
  `);

  _initialized = true;
}
