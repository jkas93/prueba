'use server';

import { adminDb, adminAuth } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';
import { revalidatePath } from 'next/cache';

// Helper de auth
async function getCaller() {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);
  if (!tokens) return null;

  const callerUid = tokens.decodedToken.uid;
  const profile = await adminDb.collection('users').doc(callerUid).get();
  const isSuperadmin = profile.data()?.system_role === 'superadmin';
  return { uid: callerUid, isSuperadmin };
}

// Verifica si el caller puede gestionar el equipo
async function verifyAccess(projectId: string) {
  const caller = await getCaller();
  if (!caller) throw new Error('No autorizado');

  const projectRef = adminDb.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();
  
  if (!projectSnap.exists) throw new Error('Proyecto no encontrado');
  
  const projectData = projectSnap.data();
  if (projectData?.owner_id !== caller.uid && !caller.isSuperadmin) {
    throw new Error('No tienes permiso para gestionar el equipo');
  }

  return { projectRef, projectData, caller };
}


// ─── Añadir miembro por email ───
export async function addMemberByEmail(projectId: string, emailToInvite: string) {
  try {
    const { projectRef, projectData } = await verifyAccess(projectId);

    // 2. Buscar al usuario por correo en Firebase Auth
    let targetUid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(emailToInvite.trim());
      targetUid = userRecord.uid;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        return { success: false, error: 'No se encontró cuenta con ese correo. Deben registrarse primero.' };
      }
      return { success: false, error: 'Error al buscar el usuario' };
    }

    // 3. Evitar que se añada al dueño
    if (targetUid === projectData?.owner_id) {
      return { success: false, error: 'El dueño del proyecto ya tiene acceso.' };
    }

    // 4. Verificar si ya es miembro
    const existingMembers: string[] = projectData?.members || [];
    if (existingMembers.includes(targetUid)) {
      return { success: false, error: 'Este usuario ya es miembro del proyecto.' };
    }

    // 5. Añadir al proyecto
    await projectRef.update({
      members: [...existingMembers, targetUid]
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, message: '¡Invitación enviada y usuario añadido!' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Obtener lista de miembros ───
export async function getTeamMembers(projectId: string) {
  const caller = await getCaller();
  if (!caller) return [];

  const projectRef = adminDb.collection('projects').doc(projectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return [];
  
  const projectData = projectSnap.data();
  const isMember = projectData?.owner_id === caller.uid || (projectData?.members || []).includes(caller.uid);
  if (!isMember && !caller.isSuperadmin) return []; // Solo miembros o superadmins pueden ver el equipo

  const memberIds: string[] = projectData?.members || [];
  
  // Buscar roles personalizados
  const rolesSnap = await adminDb.collection('project_member_roles')
    .where('project_id', '==', projectId)
    .get();
  const rolesMap = new Map();
  rolesSnap.docs.forEach(d => {
    rolesMap.set(d.data().user_id, d.data().role);
  });

  const memberProfiles = await Promise.all(
    memberIds.map(async (uid) => {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      const userData = userSnap.data();
      
      let email = 'Desconocido';
      try {
        const authUser = await adminAuth.getUser(uid);
        email = authUser.email || 'Desconocido';
      } catch {}

      return {
        user_id: uid,
        role: rolesMap.get(uid) || userData?.role || 'viewer',
        full_name: userData?.full_name || '',
        email: email,
      };
    })
  );

  return memberProfiles;
}

// ─── Eliminar miembro ───
export async function removeTeamMember(projectId: string, userIdToRemove: string) {
  try {
    const { projectRef, projectData } = await verifyAccess(projectId);
    
    const existingMembers: string[] = projectData?.members || [];
    await projectRef.update({
      members: existingMembers.filter(id => id !== userIdToRemove)
    });

    // Limpiar rol si existe
    await adminDb.collection('project_member_roles').doc(`${projectId}_${userIdToRemove}`).delete();

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Cambiar rol de miembro ───
export async function changeTeamMemberRole(projectId: string, userIdToChange: string, newRole: string) {
  try {
    await verifyAccess(projectId);

    await adminDb.collection('project_member_roles').doc(`${projectId}_${userIdToChange}`).set({
      project_id: projectId,
      user_id: userIdToChange,
      role: newRole,
    }, { merge: true });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
