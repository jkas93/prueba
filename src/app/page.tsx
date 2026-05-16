import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);

  if (tokens) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
