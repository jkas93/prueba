import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    cookieName: 'AuthToken',
    cookieSignatureKeys: ['secret-key-for-signing-cookies'],
    serviceAccount: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, "\n"),
    }
  });

  if (!tokens) {
    redirect('/login');
  }

  const user = tokens.decodedToken;

  // Get user profile
  const userDoc = await adminDb.collection('users').doc(user.uid).get();
  const profileData = userDoc.data();
  const profile = profileData ? {
    full_name: profileData.full_name as string,
    avatar_url: profileData.avatar_url as string,
    system_role: profileData.system_role as 'user' | 'superadmin' | undefined
  } : null;

  // Supabase User type shim for Sidebar
  const userShim = {
    id: user.uid,
    email: user.email || '',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  };

  return (
    <div className="h-screen flex overflow-hidden pb-16 md:pb-0 landscape:pb-0">
      {/* Sidebar Modular Contráible */}
      <Sidebar user={{ email: user.email || '' }} profile={profile} />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden landscape:hidden fixed bottom-0 left-0 right-0 bg-primary-800/95 backdrop-blur-md border-t border-accent-400/10 z-[100] flex items-center justify-around px-4 py-2 safe-area-bottom shadow-[0_-4px_20px_rgba(0,11,28,0.5)]">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-accent-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          <span className="text-[10px] font-medium tracking-wide">Inicio</span>
        </Link>

        {profile?.system_role === 'superadmin' && (
          <Link href="/admin" className="flex flex-col items-center gap-1 text-slate-400 hover:text-accent-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="text-[10px] font-medium tracking-wide">Admin</span>
          </Link>
        )}
        <Link href="/profile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-accent-400 transition-colors">
          <div className="w-6 h-6 rounded-full bg-accent-400/20 flex items-center justify-center text-[11px] font-bold text-accent-400">
             {(profile?.full_name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] font-medium tracking-wide">Perfil</span>
        </Link>
        <form action="/auth/signout" method="POST" className="flex">
          <button type="submit" className="flex flex-col items-center gap-1 text-slate-400 hover:text-danger-400 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span className="text-[10px] font-medium tracking-wide">Salir</span>
          </button>
        </form>
      </nav>
    </div>
  );
}
