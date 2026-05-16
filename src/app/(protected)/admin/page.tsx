import { getAllUsers } from '@/app/actions/admin';
import { UserTable } from '@/components/admin/UserTable';
import { InviteUserForm } from '@/components/admin/InviteUserForm';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const users = await getAllUsers();
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: 'AuthToken',
    cookieSignatureKeys: process.env.COOKIE_SIGNATURE_KEYS
      ? process.env.COOKIE_SIGNATURE_KEYS.split(',').map(k => k.trim())
      : ['cronograma-secret-key-2026'],
    serviceAccount: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }
  });
  const currentUserId = tokens?.decodedToken?.uid ?? '';

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      {/* Etiqueta Superior */}
      <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-bold uppercase tracking-widest shadow-sm">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Modo Dios
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-surface-100 flex items-center gap-3">
          Gestión de Cuentas
        </h1>
        <p className="text-sm text-surface-200/60 mt-1">
           Invita nuevos usuarios o modifica sus roles de acceso al sistema
        </p>
      </div>

      <InviteUserForm />

      <div className="mb-4 flex items-center justify-between">
         <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
            Directorio de Usuarios
            <span className="bg-surface-800 text-surface-300 text-[10px] px-2 py-0.5 rounded-full">{users.length}</span>
         </h2>
      </div>

      <UserTable users={users} currentUserId={currentUserId} />
      
    </div>
  );
}
