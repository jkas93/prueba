'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/hooks/useFirebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

interface TeamModalProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  variant?: 'button' | 'menuItem';
}

type Member = {
  user_id: string;
  role: string;
  full_name?: string;
  email?: string;
};

export function TeamModal({ projectId, projectName, isOwner, variant = 'button' }: TeamModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailToInvite, setEmailToInvite] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [inviting, setInviting] = useState(false);
  
  const { db } = useFirebase();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { getTeamMembers } = await import('@/app/actions/team');
      const memberProfiles = await getTeamMembers(projectId);
      setMembers(memberProfiles);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen, fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToInvite.trim()) return;
    setInviting(true);
    setSearchStatus('');

    try {
      const { addMemberByEmail } = await import('@/app/actions/team');
      const res = await addMemberByEmail(projectId, emailToInvite.trim());

      if (!res.success) {
        setSearchStatus(res.error || 'Error desconocido al añadir');
      } else {
        setEmailToInvite('');
        setSearchStatus(res.message || '¡Añadido correctamente!');
        fetchMembers();
      }
    } catch (err: unknown) {
      console.error(err);
      setSearchStatus('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      const { changeTeamMemberRole } = await import('@/app/actions/team');
      await changeTeamMemberRole(projectId, userId, newRole);
      fetchMembers();
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const removeMember = async (userId: string) => {
    if (!window.confirm('¿Seguro que deseas remover a este miembro?')) return;
    try {
      const { removeTeamMember } = await import('@/app/actions/team');
      await removeTeamMember(projectId, userId);
      fetchMembers();
    } catch (err: unknown) {
      console.error(err);
    }
  };


  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={variant === 'menuItem' ? "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-800 hover:text-surface-100 transition-colors" : "btn-secondary text-xs flex items-center gap-2 flex-shrink-0"}
        title="Gestionar Equipo"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <span className={variant === 'menuItem' ? '' : 'hidden sm:inline'}>Equipo</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative fade-in max-h-[90vh] flex flex-col">
            
            <div className="flex items-center justify-between p-5 border-b border-surface-800 bg-surface-800/50 shrink-0">
              <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-5H7v5m10 0h-5" />
                </svg>
                Equipo de {projectName}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-surface-400 hover:text-surface-100 transition-colors p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {isOwner && (
              <div className="p-5 border-b border-surface-800 bg-surface-800/20 shrink-0">
                <form onSubmit={handleInvite} className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      placeholder="Email del usuario..."
                      value={emailToInvite}
                      onChange={(e) => setEmailToInvite(e.target.value)}
                      className="w-full bg-surface-950 border border-surface-700 rounded-lg text-sm px-3 py-2 text-surface-100 focus:outline-none focus:border-accent-500"
                    />
                  </div>
                  <button type="submit" disabled={inviting || !emailToInvite} className="btn-primary text-sm whitespace-nowrap px-4 py-2">
                    {inviting ? 'Buscando...' : 'Añadir'}
                  </button>
                </form>
                {searchStatus && (
                  <p className={`text-xs mt-2 ${searchStatus.includes('¡') ? 'text-success-400' : 'text-danger-400'}`}>
                    {searchStatus}
                  </p>
                )}
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-xs font-bold text-surface-200 uppercase tracking-widest mb-4">Integrantes ({members.length})</h4>
              
              {loading ? (
                <div className="py-8 text-center"><span className="spinner"></span></div>
              ) : members.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">No hay invitados aún.</p>
              ) : (
                <ul className="space-y-3">
                  {members.map((m) => (
                    <li key={m.user_id} className="flex items-center justify-between p-3 rounded-lg border border-surface-800 bg-surface-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-500/20 flex items-center justify-center text-accent-500 font-bold text-xs uppercase">
                          {m.full_name?.charAt(0) || m.email?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-surface-100">{m.full_name || 'Usuario'}</p>
                          <p className="text-xs text-surface-400">{m.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isOwner ? (
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.user_id, e.target.value)}
                            className="bg-surface-900 border border-surface-700 rounded text-xs px-2 py-1 text-surface-100 outline-none focus:border-accent-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor (Agrega avances)</option>
                            <option value="viewer">Lector (Solo vista)</option>
                          </select>
                        ) : (
                          <span className="text-xs text-surface-400 capitalize px-2">{m.role}</span>
                        )}
                        
                        {isOwner && (
                          <button onClick={() => removeMember(m.user_id)} className="p-1.5 text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 rounded transition-colors" title="Remover">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
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
