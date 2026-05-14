'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/client';
import { doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [systemRole, setSystemRole] = useState<'user' | 'superadmin'>('user');
  const [successMessage, setSuccessMessage] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      setUserId(user.uid);
      setEmail(user.email || '');

      try {
        const { getDoc } = await import('firebase/firestore');
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setFullName(data.full_name || '');
          setSystemRole(data.system_role || 'user');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');

    try {
      await updateDoc(doc(db, 'users', userId), {
        full_name: fullName,
        updated_at: new Date().toISOString(),
      });
      
      setSuccessMessage('¡Perfil actualizado con éxito!');
      router.refresh();
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (err: unknown) {
      alert('Error actualizando perfil: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto flex justify-center items-center min-h-[50vh]">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-100">Mi Perfil</h1>
        <p className="text-sm text-surface-200/60 mt-1">
          Gestiona tu información personal y configuración
        </p>
      </div>

      <div className="glass-card p-8">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-surface-700/50">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-500 to-accent-400 flex items-center justify-center shadow-lg shadow-accent-500/20 text-4xl font-bold text-primary-900">
             {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-100">{fullName || 'Usuario'}</h2>
            <p className="text-sm text-surface-400">{email}</p>
            <span className={`inline-block mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${
              systemRole === 'superadmin' ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20' : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
            }`}>
              {systemRole === 'superadmin' ? '⚡ Superadministrador' : 'Cuenta Profesional'}
            </span>
          </div>
        </div>

        <form onSubmit={updateProfile} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-surface-200/80 mb-2">
              Nombre Completo
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="input-field max-w-md"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-surface-200/80 mb-2">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="input-field max-w-md opacity-50 cursor-not-allowed"
            />
            <p className="text-[11px] text-surface-400 mt-1.5">
              El correo está vinculado a tu cuenta para validación segura y no puede ser modificado aquí.
            </p>
          </div>

          {successMessage && (
            <div className="p-3 max-w-md rounded-lg bg-success-500/10 border border-success-500/20 text-success-400 text-sm flex items-center gap-2 fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          <div className="pt-4 border-t border-surface-700/50 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary min-w-[140px] flex justify-center"
            >
              {saving ? <span className="spinner"></span> : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
