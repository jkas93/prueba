'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useFirebase } from '@/hooks/useFirebase';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { auth } = useFirebase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Firebase enviará directamente el email de reset usando su servicio nativo
      // (configurar el template en Firebase Console > Authentication > Templates)
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSent(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Firebase devuelve "auth/user-not-found" si el email no existe —
        // por seguridad mostramos el mismo mensaje de éxito para no revelar si el email existe
        if ((err as { code?: string }).code === 'auth/user-not-found') {
          setSent(true);
        } else {
          setError(err.message || 'Error al enviar el correo de restablecimiento.');
        }
      } else {
        setError('Error desconocido.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-accent-500 to-accent-400 shadow-lg shadow-accent-400/25">
              <svg className="w-7 h-7 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-surface-100">Restablecer Contraseña</h1>
          <p className="text-sm text-surface-200/60 mt-2">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {sent ? (
            /* ── Estado: Email enviado ── */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-500/10 border border-success-500/20 mb-5">
                <svg className="w-8 h-8 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-surface-100 mb-2">¡Correo enviado!</h2>
              <p className="text-sm text-surface-200/60 mb-6 leading-relaxed">
                Si existe una cuenta con <span className="text-accent-400 font-medium">{email}</span>, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className="text-xs text-surface-200/40 mb-6">
                Revisa también tu carpeta de spam si no lo encuentras.
              </p>
              <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-sm px-6 py-2.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Volver al login
              </Link>
            </div>
          ) : (
            /* ── Formulario ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-200/80 mb-2">
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="input-field"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                id="forgot-password-submit"
                disabled={loading || !email}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading && <span className="spinner" />}
                {loading ? 'Enviando...' : 'Enviar enlace de restablecimiento'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-surface-200/50 mt-6">
          <Link href="/login" className="text-accent-400 hover:text-accent-300 font-medium">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
