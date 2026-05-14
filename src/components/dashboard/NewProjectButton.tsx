'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { useFirebase } from '@/hooks/useFirebase';

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { auth, db } = useFirebase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const user = auth.currentUser;
    if (!user) {
      setError('Sesión no encontrada');
      setLoading(false);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        owner_id: user.uid,
        members: [user.uid], // Start with owner as member for simpler rules
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (insertError: any) {
      console.error(insertError);
      setError('Error al crear proyecto: ' + insertError.message);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setError(null);
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Nuevo Proyecto
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setOpen(false); resetForm(); }}
          />

          <div className="relative glass-card p-8 w-full max-w-lg fade-in">
            <h2 className="text-xl font-bold text-surface-100 mb-6">Nuevo Proyecto</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="proj-name" className="block text-sm font-medium text-surface-200/80 mb-2">
                  Nombre del Proyecto *
                </label>
                <input
                  id="proj-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Edificio Torre Norte"
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="proj-desc" className="block text-sm font-medium text-surface-200/80 mb-2">
                  Descripción
                </label>
                <textarea
                  id="proj-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción breve del proyecto..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="proj-start" className="block text-sm font-medium text-surface-200/80 mb-2">
                    Fecha Inicio *
                  </label>
                  <input
                    id="proj-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="proj-end" className="block text-sm font-medium text-surface-200/80 mb-2">
                    Fecha Fin *
                  </label>
                  <input
                    id="proj-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="input-field"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setOpen(false); resetForm(); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="spinner" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear Proyecto</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
