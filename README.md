# Turnistica – Croce Verde

Web app per la gestione della turnazione settimanale. Costruita con **Next.js 14** e database **SQLite su Turso** (gratuito).

---

## Funzionalità

- **Turni** – Scegli la settimana, la postazione e la mansione e compila la griglia settimanale assegnando personale registrato o volontari esterni
- **Personale** – Gestisci l'anagrafica di autisti e soccorritori
- **Report** – Visualizza le ore lavorate da un dipendente in un mese

### Logica settimane
- **Settimana A** (ISO dispari): Ascoli · Venarotta · Acquasanta
- **Settimana B** (ISO pari): Venarotta · Acquasanta · Programmati · Standby
- L'autista può coprire turni da soccorritore; il soccorritore non può coprire turni da autista

---

## Setup locale (sviluppo)

### 1. Installa dipendenze
```bash
npm install
```

### 2. Crea il file `.env.local`
```env
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```
> Con `file:local.db` il database è un file SQLite locale — nessun account necessario.

### 3. Avvia il server
```bash
npm run dev
```
Apri [http://localhost:3000](http://localhost:3000)

---

## Deploy su Vercel (gratuito)

### Passo 1 – Crea un database Turso gratuito

1. Vai su [turso.tech](https://turso.tech) e crea un account gratuito
2. Installa la CLI: `npm install -g @turso/cli`
3. Login: `turso auth login`
4. Crea il database:
   ```bash
   turso db create turnistica-croce-verde
   ```
5. Ottieni l'URL:
   ```bash
   turso db show turnistica-croce-verde --url
   ```
6. Crea il token di autenticazione:
   ```bash
   turso db tokens create turnistica-croce-verde
   ```
7. Salva i valori — ti serviranno al passo 3.

### Passo 2 – Pubblica su GitHub

1. Crea un repository su [github.com](https://github.com) (può essere privato)
2. Carica tutti i file del progetto:
   ```bash
   git init
   git add .
   git commit -m "primo commit"
   git remote add origin https://github.com/TUO-UTENTE/turnistica-croce-verde.git
   git push -u origin main
   ```

### Passo 3 – Collega a Vercel

1. Vai su [vercel.com](https://vercel.com) e accedi con GitHub
2. Clicca **"Add New Project"** e seleziona il tuo repository
3. In **"Environment Variables"** aggiungi:
   | Nome | Valore |
   |------|--------|
   | `TURSO_DATABASE_URL` | `libsql://turnistica-croce-verde-TUOUTENTE.turso.io` |
   | `TURSO_AUTH_TOKEN` | il token generato al passo 1 |
4. Clicca **"Deploy"**

> Il database viene creato automaticamente al primo accesso (grazie a `CREATE TABLE IF NOT EXISTS`).

---

## Struttura progetto

```
src/
  app/
    page.tsx              # Home
    turni/page.tsx        # Pagina turni (principale)
    personale/page.tsx    # Gestione personale
    report/page.tsx       # Report mensile
    api/
      personale/          # CRUD personale
      turni/              # CRUD turni standard
      programmati/        # CRUD turni programmati
      report/             # Generazione report
  lib/
    db.ts                 # Client Turso + init tabelle
    types.ts              # Tipi TypeScript e costanti
    utils.ts              # Helper date/settimane
```

---

## Note tecniche

- Il database si auto-inizializza alla prima richiesta API (non serve una migration manuale)
- L'autosave è attivo: ogni modifica a un turno viene salvata immediatamente
- Il piano gratuito Turso include 500 database, 9 GB storage e 1 miliardo di letture al mese
