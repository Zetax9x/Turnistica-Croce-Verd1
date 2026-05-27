'use client';

import { useEffect, useState } from 'react';
import { getMondayOfWeek, toISO, fromISO, getWeekLabel, computeWeekTypeFromRef, getWeekType, addWeeks } from '@/lib/utils';
import { POSTAZIONI_A, POSTAZIONI_B, POSTAZIONE_LABEL, type TipoSettimana } from '@/lib/types';

const PREVIEW_SETTIMANE = 16; // quante settimane mostrare nell'anteprima

function computeTipo(
  settimana: string,
  refSett: string | null,
  refTipo: TipoSettimana | null,
): TipoSettimana {
  if (refSett && refTipo) return computeWeekTypeFromRef(settimana, refSett, refTipo);
  return getWeekType(fromISO(settimana));
}

export default function AdminPage() {
  const today = new Date();
  const lunediOggi = toISO(getMondayOfWeek(today));

  // Stato corrente salvato nel DB
  const [refSett, setRefSett] = useState<string | null>(null);
  const [refTipo, setRefTipo] = useState<TipoSettimana | null>(null);

  // Stato del form (prima di salvare)
  const [formSett, setFormSett] = useState(lunediOggi);
  const [formTipo, setFormTipo] = useState<TipoSettimana>('A');

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // Carica impostazioni correnti
  useEffect(() => {
    fetch('/api/admin')
      .then(r => r.json())
      .then(data => {
        if (data.ref_settimana) {
          setRefSett(data.ref_settimana);
          setRefTipo(data.ref_tipo as TipoSettimana);
          setFormSett(data.ref_settimana);
          setFormTipo(data.ref_tipo as TipoSettimana);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref_settimana: formSett, ref_tipo: formTipo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setRefSett(formSett);
      setRefTipo(formTipo);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  };

  // Genera anteprima: 4 settimane indietro + 12 settimane avanti
  const primaSettimana = addWeeks(lunediOggi, -4);
  const previewSettimane = Array.from({ length: PREVIEW_SETTIMANE }, (_, i) =>
    addWeeks(primaSettimana, i)
  );

  // Quando l'utente cambia il form, mostra un'anteprima "pendente"
  const previewRefSett = formSett;
  const previewRefTipo = formTipo;

  // Controlla se il form è diverso da quello salvato
  const isDirty = formSett !== refSett || formTipo !== refTipo;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          ⚙️ Impostazioni
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configurazione della turnazione</p>
      </div>

      {/* Card configurazione */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-700 mb-1">Tipo settimana – punto di riferimento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Definisci quale tipo (A o B) ha una specifica settimana. Tutte le altre settimane
          si alterneranno automaticamente a partire da questo punto.
        </p>

        {loading ? (
          <div className="text-gray-400 text-sm py-4">Caricamento…</div>
        ) : (
          <>
            {refSett && refTipo && !isDirty && (
              <div className="mb-4 text-sm bg-verde-50 border border-verde-200 rounded-lg px-3 py-2 text-verde-800">
                <strong>Riferimento attivo:</strong> settimana del {getWeekLabel(refSett)} →{' '}
                <span className={`badge ${refTipo === 'A' ? 'badge-a' : 'badge-b'}`}>
                  Tipo {refTipo}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-4">
              {/* Selettore settimana */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Settimana di riferimento
                </label>
                <input
                  type="date"
                  className="input w-48"
                  value={formSett}
                  onChange={e => {
                    // Normalizza al lunedì della settimana selezionata
                    const d = e.target.value ? getMondayOfWeek(fromISO(e.target.value)) : getMondayOfWeek(today);
                    setFormSett(toISO(d));
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lun {getWeekLabel(formSett)}
                </p>
              </div>

              {/* Selettore tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo di quella settimana
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormTipo('A')}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm border-2 transition-colors ${
                      formTipo === 'A'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                    }`}
                  >
                    Settimana A
                  </button>
                  <button
                    onClick={() => setFormTipo('B')}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm border-2 transition-colors ${
                      formTipo === 'B'
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'
                    }`}
                  >
                    Settimana B
                  </button>
                </div>
              </div>

              {/* Bottone salva */}
              <div>
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className={`btn-primary ${(!isDirty && !saving) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? 'Salvataggio…' : '💾 Salva'}
                </button>
              </div>
            </div>

            {saved && (
              <div className="mt-3 text-verde-700 text-sm bg-verde-50 border border-verde-200 rounded-lg px-3 py-2">
                ✓ Riferimento salvato. Le settimane sono state aggiornate.
              </div>
            )}
            {error && (
              <div className="mt-3 text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ✗ {error}
              </div>
            )}

            {/* Legenda tipi */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <span className="badge-a font-semibold mr-2">Tipo A</span>
                <span className="text-blue-700">Ascoli · Venarotta · Acquasanta</span>
              </div>
              <div className="bg-purple-50 rounded-lg px-3 py-2">
                <span className="badge-b font-semibold mr-2">Tipo B</span>
                <span className="text-purple-700">Venarotta · Acquasanta · Programmati · Standby</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Anteprima settimane */}
      {!loading && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-1">Anteprima settimane</h2>
          <p className="text-xs text-gray-400 mb-4">
            {isDirty
              ? '⚡ Anteprima basata sul nuovo riferimento (non ancora salvato)'
              : 'Basata sulla configurazione attiva'}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Settimana</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600 w-20">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Postazioni attive</th>
                </tr>
              </thead>
              <tbody>
                {previewSettimane.map((sett, idx) => {
                  const tipo = computeTipo(sett, previewRefSett, previewRefTipo);
                  const isCurrentWeek = sett === lunediOggi;
                  const postazioni = tipo === 'A' ? [...POSTAZIONI_A] : [...POSTAZIONI_B];

                  return (
                    <tr
                      key={sett}
                      className={`border-b border-gray-100 ${
                        isCurrentWeek
                          ? 'bg-verde-50 font-semibold'
                          : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      }`}
                    >
                      <td className="px-3 py-2">
                        {getWeekLabel(sett)}
                        {isCurrentWeek && (
                          <span className="ml-2 text-xs bg-verde-600 text-white rounded px-1.5 py-0.5">
                            oggi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={tipo === 'A' ? 'badge-a' : 'badge-b'}>
                          {tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {postazioni.map(p => POSTAZIONE_LABEL[p]).join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
