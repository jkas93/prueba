'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/hooks/useFirebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  date: string;
}

interface MilestoneModalProps {
  projectId: string;
  isOwner: boolean;
  onUpdate: () => void;
}

export function MilestoneModal({ projectId, isOwner, onUpdate }: MilestoneModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const { db } = useFirebase();

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'project_milestones'), where('project_id', '==', projectId));
      const snap = await getDocs(q);
      const data: Milestone[] = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Milestone))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setMilestones(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchMilestones();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setSaving(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, 'project_milestones', editingId), { name: name.trim(), date: date });
      } else {
        const docRef = doc(collection(db, 'project_milestones'));
        await setDoc(docRef, {
          project_id: projectId,
          name: name.trim(),
          date: date
        });
      }

      setName('');
      setDate('');
      setEditingId(null);
      fetchMilestones();
      onUpdate(); 
      
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: Milestone) => {
    setName(m.name);
    setDate(m.date);
    setEditingId(m.id);
  };

  const cancelEdit = () => {
    setName('');
    setDate('');
    setEditingId(null);
  };

  const removeMilestone = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este hito?')) return;
    try {
      await deleteDoc(doc(db, 'project_milestones', id));
      fetchMilestones();
      onUpdate(); 
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 border-accent-400/40 text-accent-600 bg-accent-400/10 hover:bg-accent-400 hover:text-primary-900 transition-all font-semibold whitespace-nowrap"
        title="Gestionar Hitos"
      >
        <svg className="w-4 h-4 text-inherit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 12L12 22L22 12L12 2Z" />
        </svg>
        <span className="hidden md:inline">Hitos</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative fade-in max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between p-5 border-b border-surface-800 bg-surface-800/50 shrink-0">
              <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 12L12 22L22 12L12 2Z" />
                </svg>
                {editingId ? 'Editar Hito' : 'Hitos del Proyecto'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-surface-400 hover:text-surface-100 transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {isOwner && (
              <div className="p-5 border-b border-surface-800 bg-surface-800/20 shrink-0">
                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del hito..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-surface-950 border border-surface-700 rounded-lg text-sm px-3 py-2 text-surface-100 focus:outline-none focus:border-accent-500"
                  />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-surface-950 border border-surface-700 rounded-lg text-sm px-3 py-2 text-surface-100 focus:outline-none focus:border-accent-500"
                  />
                  <div className="md:col-span-2 flex gap-2">
                    <button type="submit" disabled={saving || !name || !date} className="flex-1 btn-primary text-sm px-4 py-2">
                      {saving ? 'Guardando...' : editingId ? 'Actualizar Hito' : 'Añadir Nuevo Hito'}
                    </button>
                    {editingId && (
                      <button type="button" onClick={cancelEdit} className="btn-secondary text-sm px-4 py-2">
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-xs font-bold text-surface-200 uppercase tracking-widest mb-4">Hitos Programados ({milestones.length})</h4>
              
              {loading ? (
                <div className="py-8 text-center"><span className="spinner"></span></div>
              ) : milestones.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">No hay hitos definidos aún.</p>
              ) : (
                <ul className="space-y-3">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-800 bg-surface-800/50 hover:border-accent-500/30 transition-colors">
                      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => startEdit(m)}>
                        <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center text-accent-500 font-bold text-xs group-hover:bg-accent-500/20 transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12L12 22L22 12L12 2Z" /></svg>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-surface-100 group-hover:text-accent-400 transition-colors">{m.name}</p>
                          <p className="text-[10px] text-surface-400 font-mono uppercase">{m.date}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {isOwner && (
                          <>
                            <button onClick={() => startEdit(m)} className="p-1.5 text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 rounded transition-colors" title="Editar">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/></svg>
                            </button>
                            <button onClick={() => removeMilestone(m.id)} className="p-1.5 text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 rounded transition-colors" title="Eliminar">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
