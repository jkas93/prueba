'use server';

import { adminDb, adminAuth } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';
import { revalidatePath } from 'next/cache';

// ── Auth helper ────────────────────────────────────────────────
async function getCaller() {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);
  if (!tokens) return null;

  const callerUid = tokens.decodedToken.uid;
  const profile   = await adminDb.collection('users').doc(callerUid).get();
  const isSuperadmin = profile.data()?.system_role === 'superadmin';
  return { uid: callerUid, isSuperadmin };
}

// ── Access verification ────────────────────────────────────────
async function verifyAccess(projectId: string) {
  const caller = await getCaller();
  if (!caller) throw new Error('No autorizado');

  const projectRef  = adminDb.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();

  if (!projectSnap.exists) throw new Error('Proyecto no encontrado');

  const projectData = projectSnap.data();
  if (projectData?.owner_id !== caller.uid && !caller.isSuperadmin) {
    throw new Error('No tienes permiso para gestionar el equipo');
  }

  return { projectRef, projectData, caller };
}

// ── Add member by email ────────────────────────────────────────
export async function addMemberByEmail(projectId: string, emailToInvite: string) {
  try {
    const { projectRef, projectData } = await verifyAccess(projectId);

    let targetUid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(emailToInvite.trim());
      targetUid = userRecord.uid;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'auth/user-not-found') {
        return { success: false, error: 'No se encontró cuenta con ese correo. Deben registrarse primero.' };
      }
      return { success: false, error: 'Error al buscar el usuario' };
    }

    if (targetUid === projectData?.owner_id) {
      return { success: false, error: 'El dueño del proyecto ya tiene acceso.' };
    }

    const existingMembers: string[] = projectData?.members || [];
    if (existingMembers.includes(targetUid)) {
      return { success: false, error: 'Este usuario ya es miembro del proyecto.' };
    }

    await projectRef.update({ members: [...existingMembers, targetUid] });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: '¡Invitación enviada y usuario añadido!' };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

// ── Get team members (batch-optimized, no N+1) ────────────────
export async function getTeamMembers(projectId: string) {
  const caller = await getCaller();
  if (!caller) return [];

  const projectRef  = adminDb.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return [];

  const projectData = projectSnap.data();
  const isMember =
    projectData?.owner_id === caller.uid ||
    (projectData?.members || []).includes(caller.uid);
  if (!isMember && !caller.isSuperadmin) return [];

  const memberIds: string[] = projectData?.members || [];
  if (memberIds.length === 0) return [];

  // 1. Batch-read Firestore profiles (single round-trip)
  const docRefs   = memberIds.map((uid) => adminDb.collection('users').doc(uid));
  const userDocs  = await adminDb.getAll(...docRefs);
  const profileMap = new Map(userDocs.map((d) => [d.id, d.data()]));

  // 2. Batch-read Auth emails (single round-trip, max 100 per call)
  const authResult = await adminAuth.getUsers(memberIds.map((uid) => ({ uid })));
  const emailMap   = new Map(authResult.users.map((u) => [u.uid, u.email || 'Desconocido']));

  // 3. Batch-read roles (single query)
  const rolesSnap = await adminDb
    .collection('project_member_roles')
    .where('project_id', '==', projectId)
    .get();
  const rolesMap = new Map(rolesSnap.docs.map((d) => [d.data().user_id, d.data().role]));

  return memberIds.map((uid) => {
    const userData = profileMap.get(uid);
    return {
      user_id:   uid,
      role:      rolesMap.get(uid) || userData?.role || 'viewer',
      full_name: userData?.full_name || '',
      email:     emailMap.get(uid) || 'Desconocido',
    };
  });
}

// ── Remove member ──────────────────────────────────────────────
export async function removeTeamMember(projectId: string, userIdToRemove: string) {
  try {
    const { projectRef, projectData } = await verifyAccess(projectId);

    const existingMembers: string[] = projectData?.members || [];
    await projectRef.update({ members: existingMembers.filter((id) => id !== userIdToRemove) });

    await adminDb
      .collection('project_member_roles')
      .doc(`${projectId}_${userIdToRemove}`)
      .delete();

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

// ── Change member role ─────────────────────────────────────────
export async function changeTeamMemberRole(
  projectId: string,
  userIdToChange: string,
  newRole: string
) {
  try {
    await verifyAccess(projectId);

    await adminDb
      .collection('project_member_roles')
      .doc(`${projectId}_${userIdToChange}`)
      .set({ project_id: projectId, user_id: userIdToChange, role: newRole }, { merge: true });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
  }
}
