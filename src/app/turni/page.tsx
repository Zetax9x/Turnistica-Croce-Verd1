'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FASCE, FASCIA_LABEL, FASCIA_ORARIO,
  GIORNI_BREVI, GIORNI_LUNGHI, POSTAZIONE_LABEL,
  type Personale, type Turno, type Fascia, type Programmato,
} from '@/lib/types';
import {
  getMondayOfWeek, toISO, fromISO, getPostazioni, getWeekLabel, getDayDate, formatDateIT,
} from '@/lib/utils';
import type { TipoSettimana } from '@/lib/types';

// ─── Componente cella turno ───────────────────────────────────────────────────

interface ShiftCellProps {
  turno: Turno | undefined;
  personaleList: Personale[];
  ruolo: 'autista' | 'soccorritore';
  onSave: (personale_id: number | null, volontario: string | null) => Promise<string | null>;
}

function ShiftCell({ turno, personaleList, ruolo, onSave }: ShiftCellProps) {
  // Per turno autista solo autisti; per turno soccorritore tutti
  const opzioni = ruolo === 'autista'
    ? personaleList.filter(p => p.ruolo === 'autista' && p.attivo)
    : personaleList.filter(p => p.attivo);

  const currentVal = turno?.personale_id
    ? `p:${turno.personale_id}`
    : turno?.volontario ? 'v:custom' : '';

  const [val, setVal]         = useState(currentVal);
  const [prevVal, setPrevVal] = useState(currentVal);
  const [volName, setVolName] = useState(turno?.volontario ?? '');
  const [saving, setSaving]   = useState(false);
  const [errore, setErrore]   = useState<string | null>(null);

  // Sincronizza quando arrivano nuovi dati dall'esterno
  useEffect(() => {
    const v = turno?.personale_id ? `p:${turno.personale_id}` : turno?.volontario ? 'v:custom' : '';
    setVal(v);
    setPrevVal(v);
    setVolName(turno?.volontario ?? '');
    setErrore(null);
  }, [turno]);

  const doSave = async (pid: number | null, vol: string | null, fallbackVal: string) => {
    setSaving(true);
    setErrore(null);
    const err = await onSave(pid, vol);
    if (err) {
      setErrore(err);
      setVal(fallbackVal); // ripristina selezione precedente
    } else {
      setPrevVal(pid ? `p:${pid}` : vol ? 'v:custom' : '');
    }
    setSaving(false);
  };

  const handleChange = async (newVal: string) => {
    setErrore(null);
    setVal(newVal);
    if (newVal === '') {
      await doSave(null, null, prevVal);
    } else if (newVal.startsWith('p:')) {
      await doSave(Number(newVal.slice(2)), null, prevVal);
    }
    // 'v:custom' → attende che l'utente scriva il nome
  };

  const handleVolontarioBlur = async () => {
    if (val === 'v:custom') {
      await doSave(null, volName || null, prevVal);
    }
  };

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <select
        className={`w-full border rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-verde-400 ${errore ? 'border-red-400' : 'border-gray-200'}`}
        value={val}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
      >
        <option value="">– vuoto –</option>
        <optgroup label="Personale">
          {opzioni.map(p => (
            <option key={p.id} value={`p:${p.id}`}>
              {p.nome}{p.ruolo === 'autista' && ruolo === 'soccorritore' ? ' (A)' : ''}
            </option>
          ))}
        </optgroup>
        <option value="v:custom">✏️ Volontario esterno…</option>
      </select>

      {val === 'v:custom' && (
        <input
          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-verde-400"
          placeholder="Nome volontario"
          value={volName}
          onChange={e => setVolName(e.target.value)}
          onBlur={handleVolontarioBlur}
          onKeyDown={e => e.key === 'Enter' && handleVolontarioBlur()}
        />
      )}

      {/* Messaggio di conflitto */}
      {errore && (
        <span className="text-xs text-red-600 bg-red-50 rounded px-1.5 py-0.5 leading-tight">
          ⚠️ {errore}
        </span>
      )}

      {/* Label assegnato (solo se non c'è errore) */}
      {!errore && turno && (turno.personale_id || turno.volontario) && (
        <span className="text-xs text-verde-700 font-medium truncate">
          ✓ {turno.personale_id ? turno.personale_nome : turno.volontario}
        </span>
      )}
      {saving && <span className="text-xs text-gray-400">Salvataggio…</span>}
    </div>
  );
}

// ─── Tabella postazione normale ───────────────────────────────────────────────

interface StationTableProps {
  settimana: string;
  postazione: string;
  ruolo: 'autista' | 'soccorritore';
  personaleList: Personale[];
}

function StationTable({ settimana, postazione, ruolo, personaleList }: StationTableProps) {
  const [turni, setTurni] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);

  const [fetchError, setFetchError] = useState('');

  const fetchTurni = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/turni?settimana=${settimana}&postazione=${postazione}`);
      const data = await res.json();
      setTurni(Array.isArray(data) ? data : []);
      if (!res.ok) setFetchError(data?.error ?? 'Errore caricamento turni');
    } catch {
      setTurni([]);
      setFetchError('Errore di rete');
    }
    setLoading(false);
  }, [settimana, postazione]);

  useEffect(() => { fetchTurni(); }, [fetchTurni]);

  const getTurno = (giorno: number, fascia: Fascia) =>
    turni.find(t => t.giorno === giorno && t.fascia === fascia && t.ruolo === ruolo);

  const saveTurno = async (giorno: number, fascia: Fascia, personale_id: number | null, volontario: string | null): Promise<string | null> => {
    const res = await fetch('/api/turni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settimana, postazione, giorno, fascia, ruolo, personale_id, volontario }),
    });
    if (!res.ok) {
      const data = await res.json();
      return data?.error ?? 'Errore salvataggio';
    }
    await fetchTurni();
    return null;
  };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Caricamento…</div>;
  if (fetchError) return (
    <div className="py-6 px-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <strong>Errore:</strong> {fetchError}
      {fetchError.includes('TURSO_DATABASE_URL') && (
        <p className="mt-1 text-red-500">Crea il file <code>.env.local</code> con <code>TURSO_DATABASE_URL=file:local.db</code> e riavvia il server.</p>
      )}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-600 w-28">Giorno</th>
            {FASCE.map(f => (
              <th key={f} className="border border-gray-200 px-3 py-2 text-center font-medium text-gray-600 min-w-[160px]">
                <div>{FASCIA_LABEL[f]}</div>
                <div className="text-xs text-gray-400 font-normal">{FASCIA_ORARIO[f]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GIORNI_BREVI.map((g, i) => {
            const dayNum = i + 1;
            const data = getDayDate(settimana, dayNum);
            return (
              <tr key={dayNum} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="border border-gray-200 px-3 py-2">
                  <div className="font-medium">{GIORNI_LUNGHI[i]}</div>
                  <div className="text-xs text-gray-400">{formatDateIT(data)}</div>
                </td>
                {FASCE.map(fascia => (
                  <td key={fascia} className="border border-gray-200 px-2 py-2 align-top">
                    <ShiftCell
                      turno={getTurno(dayNum, fascia)}
                      personaleList={personaleList}
                      ruolo={ruolo}
                      onSave={(pid, vol) => saveTurno(dayNum, fascia, pid, vol)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabella Programmati ──────────────────────────────────────────────────────

interface ProgrammatiTableProps {
  settimana: string;
  personaleList: Personale[];
}

interface SlotRow {
  id?: number;
  giorno: number;
  ora_inizio: string;
  ora_fine: string;
  personale_id: number | null;
  volontario: string | null;
  personale_nome?: string;
  isNew?: boolean;
  saving?: boolean;
}

function ProgrammatiTable({ settimana, personaleList }: ProgrammatiTableProps) {
  const [programmati, setProgrammati] = useState<Programmato[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSlot, setPendingSlot] = useState<Partial<SlotRow> | null>(null);

  const fetchProgrammati = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/programmati?settimana=${settimana}`);
      const data = await res.json();
      setProgrammati(Array.isArray(data) ? data : []);
    } catch {
      setProgrammati([]);
    }
    setLoading(false);
  }, [settimana]);

  useEffect(() => { fetchProgrammati(); }, [fetchProgrammati]);

  const byDay = (giorno: number) => programmati.filter(p => p.giorno === giorno);

  const addSlot = (giorno: number) => {
    setPendingSlot({ giorno, ora_inizio: '', ora_fine: '', personale_id: null, volontario: null });
  };

  const saveNewSlot = async () => {
    if (!pendingSlot) return;
    const res = await fetch('/api/programmati', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settimana,
        giorno: pendingSlot.giorno,
        ora_inizio: pendingSlot.ora_inizio || null,
        ora_fine: pendingSlot.ora_fine || null,
        personale_id: pendingSlot.personale_id || null,
        volontario: pendingSlot.volontario || null,
      }),
    });
    if (res.ok) {
      setPendingSlot(null);
      await fetchProgrammati();
    }
  };

  const updateSlot = async (id: number, field: string, value: string | number | null) => {
    const slot = programmati.find(p => p.id === id)!;
    const updated = { ...slot, [field]: value };
    await fetch(`/api/programmati/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    await fetchProgrammati();
  };

  const deleteSlot = async (id: number) => {
    await fetch(`/api/programmati/${id}`, { method: 'DELETE' });
    await fetchProgrammati();
  };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Caricamento…</div>;

  return (
    <div className="space-y-3">
      {GIORNI_BREVI.map((g, i) => {
        const dayNum = i + 1;
        const slots = byDay(dayNum);
        const data = getDayDate(settimana, dayNum);
        const isPending = pendingSlot?.giorno === dayNum;

        return (
          <div key={dayNum} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
              <span className="font-medium text-sm">
                {GIORNI_LUNGHI[i]} <span className="text-gray-400 font-normal text-xs ml-1">{formatDateIT(data)}</span>
              </span>
              <button onClick={() => addSlot(dayNum)} className="text-verde-600 hover:text-verde-700 text-sm font-medium">
                + Aggiungi slot
              </button>
            </div>

            {slots.length === 0 && !isPending && (
              <div className="px-4 py-3 text-gray-400 text-xs">Nessun turno programmato</div>
            )}

            {slots.map(slot => (
              <div key={slot.id} className="px-4 py-2 flex items-center gap-3 border-t border-gray-100 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="border border-gray-200 rounded px-2 py-1 text-xs"
                    defaultValue={slot.ora_inizio ?? ''}
                    onBlur={e => updateSlot(slot.id!, 'ora_inizio', e.target.value || null)}
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="time"
                    className="border border-gray-200 rounded px-2 py-1 text-xs"
                    defaultValue={slot.ora_fine ?? ''}
                    onBlur={e => updateSlot(slot.id!, 'ora_fine', e.target.value || null)}
                  />
                </div>

                <select
                  className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 max-w-xs bg-white"
                  value={slot.personale_id ? `p:${slot.personale_id}` : slot.volontario ? 'v:custom' : ''}
                  onChange={async e => {
                    const v = e.target.value;
                    if (v.startsWith('p:')) await updateSlot(slot.id!, 'personale_id', Number(v.slice(2)));
                    else if (v === '') await updateSlot(slot.id!, 'personale_id', null);
                  }}
                >
                  <option value="">– nessuno –</option>
                  <optgroup label="Personale">
                    {personaleList.filter(p => p.attivo).map(p => (
                      <option key={p.id} value={`p:${p.id}`}>{p.nome} ({p.ruolo})</option>
                    ))}
                  </optgroup>
                </select>

                {slot.personale_id && (
                  <span className="text-xs text-verde-700">✓ {slot.personale_nome}</span>
                )}
                {slot.volontario && (
                  <input
                    type="text"
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-32"
                    defaultValue={slot.volontario}
                    onBlur={e => updateSlot(slot.id!, 'volontario', e.target.value || null)}
                  />
                )}

                <button
                  onClick={() => deleteSlot(slot.id!)}
                  className="ml-auto text-red-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}

            {isPending && (
              <div className="px-4 py-2 flex items-center gap-3 border-t border-verde-100 bg-verde-50 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="border border-gray-300 rounded px-2 py-1 text-xs"
                    value={pendingSlot.ora_inizio ?? ''}
                    onChange={e => setPendingSlot(p => ({ ...p!, ora_inizio: e.target.value }))}
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="time"
                    className="border border-gray-300 rounded px-2 py-1 text-xs"
                    value={pendingSlot.ora_fine ?? ''}
                    onChange={e => setPendingSlot(p => ({ ...p!, ora_fine: e.target.value }))}
                  />
                </div>
                <select
                  className="border border-gray-300 rounded px-2 py-1 text-xs flex-1 max-w-xs bg-white"
                  value={pendingSlot.personale_id ? `p:${pendingSlot.personale_id}` : ''}
                  onChange={e => {
                    const v = e.target.value;
                    setPendingSlot(p => ({ ...p!, personale_id: v.startsWith('p:') ? Number(v.slice(2)) : null }));
                  }}
                >
                  <option value="">– nessuno –</option>
                  <optgroup label="Personale">
                    {personaleList.filter(p => p.attivo).map(p => (
                      <option key={p.id} value={`p:${p.id}`}>{p.nome} ({p.ruolo})</option>
                    ))}
                  </optgroup>
                </select>
                <button onClick={saveNewSlot} className="btn-primary py-1 text-xs">Salva</button>
                <button onClick={() => setPendingSlot(null)} className="btn-secondary py-1 text-xs">Annulla</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Pagina principale Turni ─────────────────────────────────────────────────

export default function TurniPage() {
  const today = new Date();
  const [settimana, setSettimana]           = useState(toISO(getMondayOfWeek(today)));
  const [postazione, setPostazione]         = useState<string>('');
  const [ruolo, setRuolo]                   = useState<'autista' | 'soccorritore'>('autista');
  const [personaleList, setPersonaleList]   = useState<Personale[]>([]);
  const [tipoSettimana, setTipoSettimana]   = useState<TipoSettimana>('A');
  const [loadingTipo, setLoadingTipo]       = useState(true);

  const postazioni = getPostazioni(tipoSettimana);

  // Carica il tipo settimana dal server (considera eventuali override admin)
  useEffect(() => {
    setLoadingTipo(true);
    fetch(`/api/settimana-tipo?settimana=${settimana}`)
      .then(r => r.json())
      .then(data => {
        if (data.tipo) setTipoSettimana(data.tipo as TipoSettimana);
      })
      .catch(() => {/* usa default A */})
      .finally(() => setLoadingTipo(false));
  }, [settimana]);

  useEffect(() => {
    fetch('/api/personale')
      .then(r => r.json())
      .then(data => setPersonaleList(Array.isArray(data) ? data : []))
      .catch(() => setPersonaleList([]));
  }, []);

  // Quando cambia la settimana, resetta la postazione se non disponibile
  useEffect(() => {
    if (postazione && !postazioni.includes(postazione)) {
      setPostazione('');
    }
    if (!postazione && postazioni.length > 0) {
      setPostazione(postazioni[0]);
    }
  }, [tipoSettimana]); // eslint-disable-line

  const prevWeek = () => {
    const d = fromISO(settimana);
    d.setDate(d.getDate() - 7);
    setSettimana(toISO(d));
  };
  const nextWeek = () => {
    const d = fromISO(settimana);
    d.setDate(d.getDate() + 7);
    setSettimana(toISO(d));
  };

  const isProgrammati = postazione === 'programmati';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Turni</h1>
          <p className="text-sm text-gray-500 mt-0.5">Compilazione turnazione settimanale</p>
        </div>

        {/* Selettore settimana */}
        <div className="flex items-center gap-2 ml-auto bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded-lg">◀</button>
          <div className="text-center min-w-[200px]">
            <div className="font-semibold text-sm">{getWeekLabel(settimana)}</div>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              {loadingTipo ? (
                <span className="text-xs text-gray-400">…</span>
              ) : (
                <>
                  <span className={tipoSettimana === 'A' ? 'badge-a' : 'badge-b'}>
                    Settimana {tipoSettimana}
                  </span>
                  <span className="text-xs text-gray-400">
                    {tipoSettimana === 'A' ? 'Ascoli · Venarotta · Acquasanta' : 'Venarotta · Acquasanta · Programmati · Standby'}
                  </span>
                </>
              )}
            </div>
          </div>
          <button onClick={nextWeek} className="p-1 hover:bg-gray-100 rounded-lg">▶</button>
        </div>
      </div>

      {/* Tabs postazione */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {postazioni.map(p => (
          <button
            key={p}
            onClick={() => setPostazione(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              postazione === p
                ? 'bg-verde-600 text-white border-verde-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {POSTAZIONE_LABEL[p]}
          </button>
        ))}
      </div>

      {postazione && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg text-gray-800">{POSTAZIONE_LABEL[postazione]}</h2>

            {/* Tabs ruolo (non per programmati) */}
            {!isProgrammati && (
              <div className="flex gap-2">
                {(['autista', 'soccorritore'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRuolo(r)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      ruolo === r
                        ? r === 'autista' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {r === 'autista' ? '🚗 Autista' : '🏥 Soccorritore'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isProgrammati ? (
            <ProgrammatiTable settimana={settimana} personaleList={personaleList} />
          ) : (
            <StationTable
              key={`${settimana}-${postazione}-${ruolo}`}
              settimana={settimana}
              postazione={postazione}
              ruolo={ruolo}
              personaleList={personaleList}
            />
          )}
        </div>
      )}
    </div>
  );
}
