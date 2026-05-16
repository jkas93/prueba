import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';

export async function requireSuperadmin() {
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
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, "\n"),
    }
  });
  
  if (!tokens) redirect('/login');
  
  const userRef = adminDb.collection('users').doc(tokens.decodedToken.uid);
  const doc = await userRef.get();
  const profile = doc.data();
    
  if (profile?.system_role !== 'superadmin') {
    redirect('/dashboard');
  }
  
  return { user: tokens.decodedToken, profile };
}
