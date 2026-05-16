'use client';

import { useState } from 'react';
import { inviteUser } from '@/app/actions/admin';

type InviteResult = {
  success: boolean;
  userId?: string;
  emailSent?: boolean;
  emailError?: string;
  resetLink?: string;
};

export function InviteUserForm() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;
    
    setLoading(true);
    setResult(null);
    setCopyDone(false);
    
    try {
      const res = await inviteUser(email, fullName) as InviteResult;
      setResult(res);
      if (res.emailSent) {
        setEmail('');
        setFullName('');
      }
    } catch (err) {
      setResult({
        success: false,
        emailError: err instanceof Error ? err.message : 'Error al invitar usuario',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (result?.resetLink) {
      navigator.clipboard.writeText(result.resetLink);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    }
  };

  return (
    <div className="glass-card p-6 mb-8 fade-in">
      <h3 className="text-lg font-bold text-surface-100 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Invitar Nuevo Usuario
      </h3>
      
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-surface-200/80 mb-1">Nombre Completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: Juan Pérez"
            required
            className="w-full bg-surface-900 border border-surface-700 rounded-lg text-sm px-3 py-2 text-surface-100 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-surface-200/80 mb-1">Correo Electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@empresa.com"
            required
            className="w-full bg-surface-900 border border-surface-700 rounded-lg text-sm px-3 py-2 text-surface-100 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email || !fullName}
          className="btn-primary flex items-center justify-center gap-2 h-[38px] px-6 flex-shrink-0"
        >
          {loading ? <span className="spinner"></span> : 'Enviar Invitación'}
        </button>
      </form>
      
      {/* Resultado */}
      {result && (
        <div className="mt-4">
          {result.success && result.emailSent && (
            <div className="p-3 rounded-lg text-sm flex items-center gap-2 bg-success-500/10 text-success-400 border border-success-500/20">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Usuario creado e invitación enviada exitosamente a <strong>{email || 'su correo'}</strong>.
            </div>
          )}

          {result.success && !result.emailSent && result.resetLink && (
            <div className="p-4 rounded-lg bg-warning-500/10 border border-warning-500/20 space-y-3">
              <div className="flex items-start gap-2 text-warning-400 text-sm">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold">Usuario creado, pero el email no se pudo enviar.</p>
                  <p className="text-xs text-surface-300/60 mt-1">
                    {`Error: ${result.emailError || 'Desconocido'}`}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-surface-200/70 mb-1">Link de acceso (compártelo manualmente):</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.resetLink}
                    className="flex-1 bg-surface-900 border border-surface-700 rounded-lg text-xs px-3 py-2 text-surface-400 font-mono overflow-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      copyDone
                        ? 'bg-success-500/10 text-success-400 border-success-500/20'
                        : 'bg-surface-800 text-surface-300 border-surface-700 hover:border-accent-500/40 hover:text-accent-400'
                    }`}
                  >
                    {copyDone ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!result.success && (
            <div className="p-3 rounded-lg text-sm flex items-center gap-2 bg-danger-500/10 text-danger-400 border border-danger-500/20">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {result.emailError || 'Error al invitar usuario'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
