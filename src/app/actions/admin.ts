'use server';

import { adminDb, adminAuth } from '@/lib/firebase/server';
import { requireSuperadmin } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

type UserRecord = {
  id: string;
  full_name: string;
  avatar_url: string;
  system_role: 'user' | 'superadmin';
  email: string;
  created_at: string;
  projects: { name: string; role: string }[];
};

// ── Firebase email reset via REST API ──────────────────────────
async function sendFirebaseResetEmail(email: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Falta NEXT_PUBLIC_FIREBASE_API_KEY');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || 'Error enviando email de Firebase');
  }
  return true;
}

// ── Invite user ────────────────────────────────────────────────
export async function inviteUser(email: string, fullName: string) {
  await requireSuperadmin();

  try {
    const newUser = await adminAuth.createUser({ email, displayName: fullName });

    await adminDb.collection('users').doc(newUser.uid).set({
      full_name: fullName,
      avatar_url: '',
      system_role: 'user',
      created_at: new Date().toISOString(),
    });

    try {
      await sendFirebaseResetEmail(email);
    } catch (emailError: unknown) {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?welcome=true`,
        handleCodeInApp: false,
      };
      const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

      revalidatePath('/admin');
      return {
        success: true,
        userId: newUser.uid,
        emailSent: false,
        emailError: emailError instanceof Error ? emailError.message : String(emailError),
        resetLink,
      };
    }

    revalidatePath('/admin');
    return { success: true, userId: newUser.uid, emailSent: true };
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

// ── Update system role ─────────────────────────────────────────
export async function updateSystemRole(targetUserId: string, newRole: 'user' | 'superadmin') {
  await requireSuperadmin();

  const targetSnap = await adminDb.collection('users').doc(targetUserId).get();
  if (!targetSnap.exists) throw new Error('Usuario no encontrado.');

  await adminDb.collection('users').doc(targetUserId).update({ system_role: newRole });

  revalidatePath('/admin');
}

// ── Get all users (batch-optimized, no N+1) ────────────────────
export async function getAllUsers(): Promise<UserRecord[]> {
  await requireSuperadmin();

  const [usersSnap, projectsSnap] = await Promise.all([
    adminDb.collection('users').orderBy('created_at', 'desc').get(),
    adminDb.collection('projects').get(),
  ]);

  const projects = projectsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as { name: string; owner_id: string; members?: string[] }),
  }));

  const userIds = usersSnap.docs.map((d) => d.id);

  // Batch-fetch all Auth emails in one call (max 100 per call, chunk if needed)
  const emailMap = new Map<string, string>();
  const chunkSize = 100;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const authResult = await adminAuth.getUsers(chunk.map((uid) => ({ uid })));
    authResult.users.forEach((u) => emailMap.set(u.uid, u.email || 'Desconocido'));
  }

  return usersSnap.docs.map((docSnap) => {
    const userData    = docSnap.data();
    const uid         = docSnap.id;
    const email       = emailMap.get(uid) || 'Desconocido';

    const ownedProjects  = projects
      .filter((p) => p.owner_id === uid)
      .map((p) => ({ name: p.name, role: 'owner' }));

    const memberProjects = projects
      .filter((p) => p.owner_id !== uid && p.members?.includes(uid))
      .map((p) => ({ name: p.name, role: 'member' }));

    const uniqueProjects = Array.from(
      new Map([...ownedProjects, ...memberProjects].map((p) => [p.name, p])).values()
    );

    return {
      id:          uid,
      full_name:   userData.full_name  || '',
      avatar_url:  userData.avatar_url || '',
      system_role: (userData.system_role || 'user') as 'user' | 'superadmin',
      email,
      created_at:  userData.created_at || new Date().toISOString(),
      projects:    uniqueProjects,
    };
  });
}

// ── Resend invitation ──────────────────────────────────────────
export async function resendInvitation(targetUserId: string) {
  await requireSuperadmin();

  const docSnap = await adminDb.collection('users').doc(targetUserId).get();
  if (!docSnap.exists) throw new Error('Usuario no encontrado en Firestore.');

  let email: string;
  try {
    const authUser = await adminAuth.getUser(targetUserId);
    email = authUser.email!;
  } catch {
    throw new Error('Este usuario no tiene cuenta en Firebase Auth.');
  }

  try {
    await sendFirebaseResetEmail(email);
  } catch (err: unknown) {
    throw new Error(`Error enviando email: ${err instanceof Error ? err.message : String(err)}`);
  }

  revalidatePath('/admin');
  return { success: true };
}

// ── Delete user ────────────────────────────────────────────────
export async function deleteUser(targetUserId: string) {
  await requireSuperadmin();

  const ownedSnap = await adminDb
    .collection('projects')
    .where('owner_id', '==', targetUserId)
    .count()
    .get();
  const count = ownedSnap.data().count;

  if (count > 0) {
    throw new Error(
      `El usuario posee ${count} proyecto(s). Debes eliminar o transferir sus proyectos antes de borrar su cuenta.`
    );
  }

  try {
    await adminAuth.deleteUser(targetUserId);
  } catch (err: unknown) {
    console.warn('[deleteUser] User not in Auth:', err);
  }

  await adminDb.collection('users').doc(targetUserId).delete();

  revalidatePath('/admin');
}
