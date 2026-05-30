'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FASCE, FASCIA_LABEL, GIORNI_LUNGHI, POSTAZIONE_LABEL, isPostazioneLibera,
  type Personale, type Fascia,
} from '@/lib/types';
import { getMondayOfWeek, toISO, fromISO, getWeekLabel } from '@/lib/utils';
import type { MatchType } from '@/lib/nameMatch';

// Postazioni a tabella fissa (no programmati/altro che usano slot liberi)
const POSTAZIONI_IMPORT = Object.keys(POSTAZIONE_LABEL).filter(p => !isPostazioneLibera(p));

// ─── Tipi lato client ─────────────────────────────────────────────────────────

interface ApiCell {
  giorno: number;
  fascia: Fascia;
  raw: string;
  match: { type: MatchType; personale_id: number | null; personale_nome: string | null; volontario: string | null };
}
interface ApiFile {
  filename: string;
  postazione: string | null;
  ruolo: 'autista' | 'soccorritore' | null;
  cells: ApiCell[];
  namesCount: number;
  warning?: string;
}

interface CellState {
  giorno: number;
  fascia: Fascia;
  raw: string;
  matchType: MatchType;
  value: string;    // '' | 'p:ID' | 'v'
  volName: string;
}
interface FileState {
  filename: string;
  postazione: string;
  ruolo: 'autista' | 'soccorritore' | '';
  warning?: string;
  namesCount: number;
  cells: CellState[];
}

function toFileState(f: ApiFile): FileState {
  return {
    filename: f.filename,
    postazione: f.postazione ?? '',
    ruolo: f.ruolo ?? '',
    warning: f.warning,
    namesCount: f.namesCount,
    cells: f.cells.map(c => ({
      giorno: c.giorno,
      fascia: c.fascia,
      raw: c.raw,
      matchType: c.match.type,
      value: c.match.personale_id ? `p:${c.match.personale_id}` : c.match.volontario ? 'v' : '',
      volName: c.match.volontario ?? '',
    })),
  };
}

// ─── Pagina Importa ───────────────────────────────────────────────────────────

export default function ImportaPage() {
  const today = new Date();
  const [settimana, setSettimana]       = useState(toISO(getMondayOfWeek(today)));
  const [personaleList, setPersonaleList] = useState<Personale[]>([]);
  const [files, setFiles]               = useState<FileState[]>([]);
  const [skipFilled, setSkipFilled]     = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [applying, setApplying]         = useState(false);
  const [error, setError]               = useState('');
  const [result, setResult]             = useState<{ inseriti: number; saltati: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/personale')
      .then(r => r.json())
      .then(d => setPersonaleList(Array.isArray(d) ? d : []))
      .catch(() => setPersonaleList([]));
  }, []);

  const prevWeek = () => { const d = fromISO(settimana); d.setDate(d.getDate() - 7); setSettimana(toISO(d)); };
  const nextWeek = () => { const d = fromISO(settimana); d.setDate(d.getDate() + 7); setSettimana(toISO(d)); };

  const opzioniPersonale = (ruolo: string) =>
    ruolo === 'autista'
      ? personaleList.filter(p => p.ruolo === 'autista' && p.attivo)
      : personaleList.filter(p => p.attivo);

  // ── Upload + parsing ──
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');
    setResult(null);
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(fileList).forEach(f => fd.append('files', f));
      const res = await fetch('/api/importa', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Errore durante la lettura dei file');
      } else {
        setFiles(prev => [...prev, ...(data as ApiFile[]).map(toFileState)]);
      }
    } catch {
      setError('Errore di rete durante l’upload');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Modifiche all'anteprima ──
  const updateFile = (fi: number, patch: Partial<FileState>) =>
    setFiles(prev => prev.map((f, i) => (i === fi ? { ...f, ...patch } : f)));

  const updateCell = (fi: number, ci: number, patch: Partial<CellState>) =>
    setFiles(prev => prev.map((f, i) =>
      i === fi ? { ...f, cells: f.cells.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : f));

  const removeFile = (fi: number) => setFiles(prev => prev.filter((_, i) => i !== fi));

  const getCell = (f: FileState, giorno: number, fascia: Fascia) => {
    const ci = f.cells.findIndex(c => c.giorno === giorno && c.fascia === fascia);
    return { ci, cell: ci >= 0 ? f.cells[ci] : null };
  };

  // ── Validazione + conteggio ──
  const filesReady = files.length > 0 && files.every(f => f.postazione && f.ruolo);
  const totalDaInserire = files.reduce(
    (s, f) => s + f.cells.filter(c => c.value === 'v' ? c.volName.trim() : c.value).length, 0);

  // ── Applica ──
  const applica = async () => {
    setApplying(true);
    setError('');
    const items: {
      postazione: string; ruolo: string; giorno: number; fascia: string;
      personale_id: number | null; volontario: string | null;
    }[] = [];
    for (const f of files) {
      if (!f.postazione || !f.ruolo) continue;
      for (const c of f.cells) {
        if (c.value.startsWith('p:')) {
          items.push({ postazione: f.postazione, ruolo: f.ruolo, giorno: c.giorno, fascia: c.fascia, personale_id: Number(c.value.slice(2)), volontario: null });
        } else if (c.value === 'v' && c.volName.trim()) {
          items.push({ postazione: f.postazione, ruolo: f.ruolo, giorno: c.giorno, fascia: c.fascia, personale_id: null, volontario: c.volName.trim() });
        }
      }
    }
    try {
      const res = await fetch('/api/importa/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settimana, items, skipFilled }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? 'Errore durante l’import');
      else { setResult({ inseriti: data.inseriti, saltati: data.saltati }); setFiles([]); }
    } catch {
      setError('Errore di rete durante l’import');
    }
    setApplying(false);
  };

  // colori bordo per tipo di match
  const cellBorder = (c: CellState) =>
    c.value === '' ? 'border-gray-200'
      : c.value === 'v' ? 'border-blue-300 bg-blue-50/40'
        : c.matchType === 'exact' ? 'border-verde-300 bg-verde-50/40'
          : c.matchType === 'fuzzy' ? 'border-amber-300 bg-amber-50/50'
            : 'border-gray-200';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-xl text-gray-800">📥 Importa turni da file</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carica i file Word (.doc/.docx) ricevuti: vengono letti i nomi, confrontati col personale
          e proposti per l&apos;inserimento. Controlla l&apos;anteprima prima di confermare.
        </p>
      </div>

      {/* ── Settimana di destinazione ── */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
        <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg text-lg leading-none">◀</button>
        <div className="flex-1 text-center">
          <div className="text-xs text-gray-400">Settimana di destinazione</div>
          <div className="font-semibold text-sm">{getWeekLabel(settimana)}</div>
        </div>
        <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg text-lg leading-none">▶</button>
      </div>

      {/* ── Risultato import ── */}
      {result && (
        <div className="bg-verde-50 border border-verde-200 rounded-xl px-4 py-3 text-sm text-verde-800">
          ✅ Import completato: <strong>{result.inseriti}</strong> turni inseriti
          {result.saltati > 0 && <>, <strong>{result.saltati}</strong> saltati (casella già piena)</>}.
          {' '}<Link href="/turni" className="underline font-medium">Vai al tabellone →</Link>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Dropzone / upload ── */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed border-gray-300 rounded-xl px-4 py-8 text-center cursor-pointer hover:border-verde-400 hover:bg-verde-50/30 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".doc,.docx"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="text-3xl mb-2">📄</div>
        <div className="text-sm font-medium text-gray-700">
          {uploading ? 'Lettura in corso…' : 'Clicca o trascina qui i file Word'}
        </div>
        <div className="text-xs text-gray-400 mt-1">.doc o .docx · più file insieme</div>
      </div>

      {/* ── Legenda ── */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-verde-300 bg-verde-50 inline-block" /> Personale (match esatto)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-amber-300 bg-amber-50 inline-block" /> Match incerto — verifica</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-blue-300 bg-blue-50 inline-block" /> Volontario</span>
        </div>
      )}

      {/* ── Anteprima per file ── */}
      {files.map((f, fi) => (
        <div key={fi} className="card space-y-3">
          {/* Header file */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-gray-800 truncate">📄 {f.filename}</div>
              <div className="text-xs text-gray-400">{f.namesCount} nomi letti</div>
            </div>
            <button onClick={() => removeFile(fi)} className="text-red-400 hover:text-red-600 text-sm">✕ Rimuovi</button>
          </div>

          {/* Postazione + ruolo */}
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">Postazione</span>
              <select
                className={`border rounded-lg px-2 py-1.5 text-sm bg-white ${f.postazione ? 'border-gray-200' : 'border-red-300'}`}
                value={f.postazione}
                onChange={e => updateFile(fi, { postazione: e.target.value })}
              >
                <option value="">– scegli –</option>
                {POSTAZIONI_IMPORT.map(p => <option key={p} value={p}>{POSTAZIONE_LABEL[p]}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-gray-500 mb-1">Ruolo</span>
              <select
                className={`border rounded-lg px-2 py-1.5 text-sm bg-white ${f.ruolo ? 'border-gray-200' : 'border-red-300'}`}
                value={f.ruolo}
                onChange={e => updateFile(fi, { ruolo: e.target.value as FileState['ruolo'] })}
              >
                <option value="">– scegli –</option>
                <option value="autista">🚗 Autista</option>
                <option value="soccorritore">🏥 Soccorritore</option>
              </select>
            </label>
          </div>

          {f.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              ⚠️ {f.warning}
            </div>
          )}

          {/* Griglia giorni × fasce */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600 w-24">Giorno</th>
                  {FASCE.map(fa => (
                    <th key={fa} className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600 min-w-[150px]">
                      {FASCIA_LABEL[fa]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GIORNI_LUNGHI.map((g, i) => {
                  const dayNum = i + 1;
                  return (
                    <tr key={dayNum} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                      <td className="border border-gray-200 px-2 py-1.5 font-medium">{g}</td>
                      {FASCE.map(fa => {
                        const { ci, cell } = getCell(f, dayNum, fa);
                        if (!cell) return <td key={fa} className="border border-gray-200 px-2 py-1.5 text-gray-300 text-center">–</td>;
                        return (
                          <td key={fa} className="border border-gray-200 px-1.5 py-1.5 align-top">
                            <div className="flex flex-col gap-1">
                              {cell.matchType === 'fuzzy' && cell.value.startsWith('p:') && (
                                <span className="text-[10px] text-amber-600">letto: «{cell.raw}»</span>
                              )}
                              <select
                                className={`w-full border rounded-md px-1.5 py-1 text-xs bg-white ${cellBorder(cell)}`}
                                value={cell.value}
                                onChange={e => updateCell(fi, ci, { value: e.target.value })}
                              >
                                <option value="">– vuoto –</option>
                                <optgroup label="Personale">
                                  {opzioniPersonale(f.ruolo).map(p => (
                                    <option key={p.id} value={`p:${p.id}`}>
                                      {p.nome}{p.ruolo === 'autista' && f.ruolo === 'soccorritore' ? ' (A)' : ''}
                                    </option>
                                  ))}
                                </optgroup>
                                <option value="v">✏️ Volontario…</option>
                              </select>
                              {cell.value === 'v' && (
                                <input
                                  className="w-full border border-blue-200 rounded-md px-1.5 py-1 text-xs"
                                  placeholder="Nome volontario"
                                  value={cell.volName}
                                  onChange={e => updateCell(fi, ci, { volName: e.target.value })}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Barra azioni ── */}
      {files.length > 0 && (
        <div className="sticky bottom-20 md:bottom-4 z-10 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={skipFilled} onChange={e => setSkipFilled(e.target.checked)} className="rounded" />
            Salta le caselle già piene
          </label>
          <span className="text-xs text-gray-400">
            {totalDaInserire} turni pronti
            {!filesReady && ' · imposta postazione e ruolo per ogni file'}
          </span>
          <button
            onClick={applica}
            disabled={!filesReady || applying || totalDaInserire === 0}
            className="btn-primary ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? 'Importazione…' : `Importa ${totalDaInserire} turni sul tabellone`}
          </button>
        </div>
      )}
    </div>
  );
}
