import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
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

  if (tokens) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
