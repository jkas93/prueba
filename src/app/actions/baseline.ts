'use server';

import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';

export async function setProjectBaseline(projectId: string) {
  // Validate owner using next-firebase-auth-edge tokens
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);

  if (!tokens) return { success: false, error: 'No autorizado' };
  const userId = tokens.decodedToken.uid;

  const projectRef = adminDb.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists || projectDoc.data()?.owner_id !== userId) {
    return { success: false, error: 'Solo el dueño puede fijar la línea base' };
  }

  // Get all activities for this project from the new flattened gantt_elements collection
  const ganttRef = adminDb.collection('gantt_elements');
  const activitiesSnapshot = await ganttRef
    .where('project_id', '==', projectId)
    .where('type', '==', 'activity')
    .get();

  if (activitiesSnapshot.empty) {
    return { success: true, message: 'No hay actividades para fijar' };
  }

  // Use Firebase Batch Writes
  let batch = adminDb.batch();
  let count = 0;

  for (const doc of activitiesSnapshot.docs) {
    const act = doc.data();
    if (act.start_date && act.end_date) {
      batch.update(doc.ref, {
        baseline_start: act.start_date,
        baseline_end: act.end_date,
        updated_at: new Date().toISOString()
      });
      count++;
    }

    if (count >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
