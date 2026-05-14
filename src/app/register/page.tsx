'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useFirebase } from '@/hooks/useFirebase';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { auth, db } = useFirebase();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Actualizar displayName
      await updateProfile(user, { displayName: fullName });

      // 3. Crear documento de perfil en Firestore (reemplazo de trigger handle_new_user)
      await setDoc(doc(db, 'users', user.uid), {
        full_name: fullName,
        avatar_url: '',
        created_at: new Date().toISOString()
      });

      // 4. Autenticar en Next.js Edge (Crear Cookie)
      const idToken = await user.getIdToken();
      const response = await fetch('/api/login', {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError('Error al iniciar sesión automáticamente tras el registro.');
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Error durante el registro');
      } else {
        setError('Error durante el registro');
      }
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-accent-500 to-accent-400 shadow-lg shadow-accent-400/25">
              <svg className="w-7 h-7 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-surface-100">Crear Cuenta</h1>
          <p className="text-sm text-surface-200/60 mt-2">
            Únete y comienza a planificar tus proyectos
          </p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleRegister} className="space-y-5">
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
                required
                className="input-field"
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
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-200/80 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
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
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading && <span className="spinner" />}
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-200/50 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-accent-400 hover:text-accent-300 font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
