import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { FIREBASE_AUTH_CONFIG } from './config';

export async function requireSuperadmin() {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);
  
  if (!tokens) redirect('/login');
  
  const userRef = adminDb.collection('users').doc(tokens.decodedToken.uid);
  const doc = await userRef.get();
  const profile = doc.data();
    
  if (profile?.system_role !== 'superadmin') {
    redirect('/dashboard');
  }
  
  return { user: tokens.decodedToken, profile };
}

export async function getProjectRole(projectId: string) {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);
  if (!tokens) return null;

  const uid = tokens.decodedToken.uid;

  // 1. Check if superadmin
  const userRef = adminDb.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (userDoc.data()?.system_role === 'superadmin') return 'admin';

  // 2. Check if project owner
  const projectRef = adminDb.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  const projectData = projectDoc.data();
  if (projectData?.owner_id === uid) return 'admin';

  // 3. Check explicit team role
  const roleRef = adminDb.collection('project_member_roles').doc(`${projectId}_${uid}`);
  const roleDoc = await roleRef.get();
  if (roleDoc.exists) return roleDoc.data()?.role || 'viewer';

  // 4. Check if member of the members array (fallback to viewer)
  if (projectData?.members && Array.isArray(projectData.members) && projectData.members.includes(uid)) {
    return 'viewer';
  }

  return null;
}
