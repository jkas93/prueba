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

// ─── Invitar usuario (crear con email) ───
export async function inviteUser(email: string, fullName: string) {
  await requireSuperadmin();

  try {
    // Create a Firebase Auth user without a password (they'll use email link / set password later)
    const newUser = await adminAuth.createUser({
      email,
      displayName: fullName,
    });

    // Create Firestore profile
    await adminDb.collection('users').doc(newUser.uid).set({
      full_name: fullName,
      avatar_url: '',
      system_role: 'user',
      created_at: new Date().toISOString(),
    });

    // Generate a password reset link so the user can set their password
    await adminAuth.generatePasswordResetLink(email);

    revalidatePath('/admin');
    return { success: true, userId: newUser.uid };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
}

// ─── Cambiar system_role de un usuario ───
export async function updateSystemRole(targetUserId: string, newRole: 'user' | 'superadmin') {
  await requireSuperadmin();

  const targetSnap = await adminDb.collection('users').doc(targetUserId).get();
  if (!targetSnap.exists) throw new Error('Usuario no encontrado.');

  await adminDb.collection('users').doc(targetUserId).update({ system_role: newRole });

  revalidatePath('/admin');
}

// ─── Obtener TODOS los usuarios ───
export async function getAllUsers(): Promise<UserRecord[]> {
  await requireSuperadmin();

  const usersSnap = await adminDb.collection('users').orderBy('created_at', 'desc').get();
  const projectsSnap = await adminDb.collection('projects').get();

  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as {
    id: string; name: string; owner_id: string; members?: string[]
  }));

  const usersWithData = await Promise.all(
    usersSnap.docs.map(async (docSnap) => {
      const userData = docSnap.data();
      let email = 'Desconocido';
      try {
        const authUser = await adminAuth.getUser(docSnap.id);
        email = authUser.email || 'Desconocido';
      } catch {
        // user may not exist in Auth
      }

      const ownedProjects = projects
        .filter(p => p.owner_id === docSnap.id)
        .map(p => ({ name: p.name, role: 'owner' }));

      const memberProjects = projects
        .filter(p => p.owner_id !== docSnap.id && p.members?.includes(docSnap.id))
        .map(p => ({ name: p.name, role: 'member' }));

      const uniqueProjects = Array.from(
        new Map([...ownedProjects, ...memberProjects].map(p => [p.name, p])).values()
      );

      return {
        id: docSnap.id,
        full_name: userData.full_name || '',
        avatar_url: userData.avatar_url || '',
        system_role: (userData.system_role || 'user') as 'user' | 'superadmin',
        email,
        created_at: userData.created_at || '',
        projects: uniqueProjects,
      };
    })
  );

  return usersWithData;
}

// ─── Eliminar usuario ───
export async function deleteUser(targetUserId: string) {
  await requireSuperadmin();

  // Prevenir eliminación si el usuario es dueño de proyectos
  const ownedSnap = await adminDb.collection('projects').where('owner_id', '==', targetUserId).count().get();
  const count = ownedSnap.data().count;

  if (count > 0) {
    throw new Error(`El usuario posee ${count} proyecto(s). Debes eliminar o transferir sus proyectos antes de borrar su cuenta.`);
  }

  await adminAuth.deleteUser(targetUserId);
  await adminDb.collection('users').doc(targetUserId).delete();

  revalidatePath('/admin');
}
