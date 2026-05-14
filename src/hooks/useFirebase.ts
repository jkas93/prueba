import { db, auth } from '@/lib/firebase/client';

export function useFirebase() {
  return { db, auth };
}
