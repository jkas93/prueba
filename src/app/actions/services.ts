'use server';

import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';
import type { ProjectService } from '@/lib/types';

export async function saveProjectServices(projectId: string, services: ProjectService[]) {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);

  if (!tokens) {
    return { success: false, error: 'No autorizado' };
  }

  const userId = tokens.decodedToken.uid;
  const projectRef = adminDb.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists || projectDoc.data()?.owner_id !== userId) {
    return { success: false, error: 'Solo el dueño puede modificar los servicios' };
  }

  try {
    // Store services inside the project document for simplicity
    await projectRef.update({
      services: services
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err: unknown) {
    console.error('Error saving services:', err);
    return { success: false, error: 'No se pudieron guardar los servicios' };
  }
}
