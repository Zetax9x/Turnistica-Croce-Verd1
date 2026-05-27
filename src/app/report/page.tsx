'use client';

import { useEffect, useState } from 'react';
import type { Personale } from '@/lib/types';
import { POSTAZIONE_LABEL, FASCIA_LABEL } from '@/lib/types';

interface RigaReport {
  data: string;
  postazione: string;
  fascia: string | null;
  orario: string;
  ore: number;
  ruolo_coperto: string | null;
  tipo: 'standard' | 'programmato';
}

interface ReportData {
  righe: RigaReport[];
  totale_ore: number;
}

function formatData(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ReportPage() {
  const now = new Date();
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [personaleId, setPersonaleId] = useState('');
  const [personaleList, setPersonaleList] = useState<Personale[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/personale')
      .then(r => r.json())
      .then(data => setPersonaleList(Array.isArray(data) ? data : []))
      .catch(() => setPersonaleList([]));
  }, []);

  const handleGenera = async () => {
    if (!personaleId) { setError('Seleziona un dipendente'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/report?anno=${anno}&mese=${mese}&personale_id=${personaleId}`);
      if (!res.ok) throw new Error('Errore server');
      setReport(await res.json());
    } catch {
      setError('Errore nel caricamento del report');
    } finally {
      setLoading(false);
    }
  };

  const personaSelezionata = personaleList.find(p => p.id === Number(personaleId));

  const nomeMese = new Date(anno, mese - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const handleStampa = () => window.print();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Report mensile</h1>
          <p className="text-sm text-gray-500 mt-1">Ore lavorate per dipendente</p>
        </div>
        {report && (
          <button onClick={handleStampa} className="btn-secondary print:hidden">🖨️ Stampa</button>
        )}
      </div>

      {/* Filtri */}
      <div className="card mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mese</label>
            <select
              className="select"
              value={mese}
              onChange={e => setMese(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(anno, i, 1).toLocaleDateString('it-IT', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
            <select
              className="select"
              value={anno}
              onChange={e => setAnno(Number(e.target.value))}
            >
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dipendente</label>
            <select
              className="select"
              value={personaleId}
              onChange={e => setPersonaleId(e.target.value)}
            >
              <option value="">Seleziona…</option>
              <optgroup label="Autisti">
                {personaleList.filter(p => p.ruolo === 'autista' && p.attivo).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
              <optgroup label="Soccorritori">
                {personaleList.filter(p => p.ruolo === 'soccorritore' && p.attivo).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {error && <div className="mt-3 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

        <div className="mt-4">
          <button onClick={handleGenera} disabled={loading} className="btn-primary w-full sm:w-auto">
            {loading ? 'Generazione…' : '📊 Genera report'}
          </button>
        </div>
      </div>

      {/* Risultato */}
      {report && (
        <div className="card">
          {/* Intestazione stampa */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              {personaSelezionata?.nome} — {nomeMese}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              {personaSelezionata && (
                <span className={personaSelezionata.ruolo === 'autista' ? 'badge-autista' : 'badge-soccorritore'}>
                  {personaSelezionata.ruolo.charAt(0).toUpperCase() + personaSelezionata.ruolo.slice(1)}
                </span>
              )}
              <span className="text-sm font-semibold text-verde-700">
                Totale: {report.totale_ore} ore
              </span>
              <span className="text-sm text-gray-500">
                ({report.righe.length} turni)
              </span>
            </div>
          </div>

          {report.righe.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              Nessun turno trovato per {personaSelezionata?.nome} nel mese selezionato.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Data</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Postazione</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Fascia / Orario</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Ruolo coperto</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Ore</th>
                  </tr>
                </thead>
                <tbody>
                  {report.righe.map((r, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-2 font-medium">{formatData(r.data)}</td>
                      <td className="px-3 py-2">
                        {POSTAZIONE_LABEL[r.postazione] ?? r.postazione}
                      </td>
                      <td className="px-3 py-2">
                        {r.fascia === 'giornata' ? (
                          <span>
                            <span className="font-medium text-verde-700">Giornata intera</span>
                            <span className="text-gray-400 ml-1 text-xs">{r.orario}</span>
                          </span>
                        ) : r.fascia ? (
                          <span>
                            <span className="font-medium">{FASCIA_LABEL[r.fascia as keyof typeof FASCIA_LABEL]}</span>
                            <span className="text-gray-400 ml-1 text-xs">{r.orario}</span>
                          </span>
                        ) : (
                          <span className="text-gray-600">{r.orario}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.ruolo_coperto ? (
                          <span className={r.ruolo_coperto === 'autista' ? 'badge-autista' : 'badge-soccorritore'}>
                            {r.ruolo_coperto}
                          </span>
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.ore > 0 ? `${r.ore}h` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-verde-50 border-t-2 border-verde-200">
                    <td colSpan={4} className="px-3 py-3 font-bold text-verde-800">TOTALE</td>
                    <td className="px-3 py-3 text-right font-bold text-verde-800 text-base">
                      {report.totale_ore}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
