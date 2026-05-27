'use client';

import { useEffect, useState } from 'react';
import type { Personale } from '@/lib/types';

type Editing = { id: number; nome: string; ruolo: string } | null;

export default function PersonalePage() {
  const [lista, setLista] = useState<Personale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState<'autista' | 'soccorritore'>('autista');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPersonale = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personale');
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPersonale(); }, []);

  const openAdd = () => {
    setEditing(null);
    setNome('');
    setRuolo('autista');
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: Personale) => {
    setEditing({ id: p.id, nome: p.nome, ruolo: p.ruolo });
    setNome(p.nome);
    setRuolo(p.ruolo);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) { setError('Inserisci il nome'); return; }
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/personale/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, ruolo, attivo: 1 }),
        });
      } else {
        await fetch('/api/personale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, ruolo }),
        });
      }
      setShowForm(false);
      await fetchPersonale();
    } catch {
      setError('Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Eliminare "${nome}"? Verrà rimosso da tutti i turni assegnati.`)) return;
    await fetch(`/api/personale/${id}`, { method: 'DELETE' });
    await fetchPersonale();
  };

  const autisti = lista.filter(p => p.ruolo === 'autista' && p.attivo);
  const soccorritori = lista.filter(p => p.ruolo === 'soccorritore' && p.attivo);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Personale</h1>
          <p className="text-sm text-gray-500 mt-1">Gestione autisti e soccorritori</p>
        </div>
        <button onClick={openAdd} className="btn-primary shrink-0">
          + Aggiungi
        </button>
      </div>

      {/* Modal aggiunta/modifica */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Modifica persona' : 'Nuova persona'}</h2>
            {error && <div className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome e Cognome</label>
                <input
                  className="input"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mansione</label>
                <select className="select" value={ruolo} onChange={e => setRuolo(e.target.value as 'autista' | 'soccorritore')}>
                  <option value="autista">Autista</option>
                  <option value="soccorritore">Soccorritore</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  L&apos;autista può essere assegnato anche come soccorritore. Il soccorritore no.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Annulla</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Caricamento…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Autisti */}
          <div className="card">
            <h2 className="font-semibold text-amber-700 mb-4 flex items-center gap-2">
              <span className="badge-autista">Autisti</span>
              <span className="text-gray-500 font-normal text-sm">({autisti.length})</span>
            </h2>
            {autisti.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nessun autista inserito</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Nome</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {autisti.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-medium">{p.nome}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => openEdit(p)} className="text-verde-600 hover:text-verde-700 text-xs px-2 py-1.5 rounded hover:bg-verde-50 mr-1">Modifica</button>
                        <button onClick={() => handleDelete(p.id, p.nome)} className="text-red-500 hover:text-red-600 text-xs px-2 py-1.5 rounded hover:bg-red-50">Elimina</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Soccorritori */}
          <div className="card">
            <h2 className="font-semibold text-cyan-700 mb-4 flex items-center gap-2">
              <span className="badge-soccorritore">Soccorritori</span>
              <span className="text-gray-500 font-normal text-sm">({soccorritori.length})</span>
            </h2>
            {soccorritori.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nessun soccorritore inserito</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Nome</th>
                    <th className="text-right py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {soccorritori.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 font-medium">{p.nome}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => openEdit(p)} className="text-verde-600 hover:text-verde-700 text-xs px-2 py-1.5 rounded hover:bg-verde-50 mr-1">Modifica</button>
                        <button onClick={() => handleDelete(p.id, p.nome)} className="text-red-500 hover:text-red-600 text-xs px-2 py-1.5 rounded hover:bg-red-50">Elimina</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
