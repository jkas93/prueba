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

// ─── Helper para enviar email de reset usando Firebase REST API ───
async function sendFirebaseResetEmail(email: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('Falta NEXT_PUBLIC_FIREBASE_API_KEY');

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || 'Error enviando email de Firebase');
  }
  return true;
}

// ─── Invitar usuario (crear con email y enviar link de acceso) ───
export async function inviteUser(email: string, fullName: string) {
  await requireSuperadmin();

  try {
    // 1. Crear usuario en Firebase Auth sin contraseña
    const newUser = await adminAuth.createUser({
      email,
      displayName: fullName,
    });

    // 2. Crear documento de perfil en Firestore con system_role
    await adminDb.collection('users').doc(newUser.uid).set({
      full_name: fullName,
      avatar_url: '',
      system_role: 'user',
      created_at: new Date().toISOString(),
    });

    // 3. Enviar el email usando el servicio nativo de Firebase Auth
    try {
      await sendFirebaseResetEmail(email);
    } catch (emailError) {
      console.error('[inviteUser] Email failed to send via Firebase:', emailError);
      // Fallback a generar el link manual por si Firebase falla
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
        // El usuario puede existir en Firestore pero no en Auth (datos migrados)
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
        created_at: userData.created_at || new Date().toISOString(),
        projects: uniqueProjects,
      };
    })
  );

  return usersWithData;
}

// ─── Reenviar invitación a un usuario existente ───
export async function resendInvitation(targetUserId: string) {
  await requireSuperadmin();

  const docSnap = await adminDb.collection('users').doc(targetUserId).get();
  if (!docSnap.exists) throw new Error('Usuario no encontrado en Firestore.');

  let email: string;
  try {
    const authUser = await adminAuth.getUser(targetUserId);
    email = authUser.email!;
  } catch {
    throw new Error('Este usuario no tiene cuenta en Firebase Auth. Usa "Invitar" para creársela.');
  }

  try {
    await sendFirebaseResetEmail(email);
  } catch (err) {
    throw new Error(`Error enviando email: ${err instanceof Error ? err.message : String(err)}`);
  }

  revalidatePath('/admin');
  return { success: true };
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

  // Eliminar de Auth (puede fallar si el usuario es "fantasma" de migración)
  try {
    await adminAuth.deleteUser(targetUserId);
  } catch (err) {
    // Si no existe en Auth, continuar y eliminar solo de Firestore
    console.warn('[deleteUser] User not in Auth:', err);
  }

  await adminDb.collection('users').doc(targetUserId).delete();

  revalidatePath('/admin');
}
