'use server';

import { adminDb } from '@/lib/firebase/server';
import { getProjectRole } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

export async function setProjectBaseline(projectId: string) {
  try {
    // 1. Authorization Check
    const role = await getProjectRole(projectId);
    if (role !== 'admin') {
      return { success: false, error: 'No tienes permiso para fijar la línea base.' };
    }

    // 2. Fetch all activities for the project
    const activitiesSnapshot = await adminDb.collection('gantt_elements')
      .where('project_id', '==', projectId)
      .where('type', '==', 'activity')
      .get();

    if (activitiesSnapshot.empty) {
      return { success: true, message: 'No hay actividades para actualizar.' };
    }

    // 3. Update activities in chunks of 500 (Firestore limit)
    const docs = activitiesSnapshot.docs;
    const chunkSize = 500;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = adminDb.batch();

      chunk.forEach((doc) => {
        const data = doc.data();
        batch.update(doc.ref, {
          baseline_start: data.start_date,
          baseline_end: data.end_date,
          updated_at: new Date().toISOString()
        });
      });

      await batch.commit();
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error setting baseline:', error);
    return { success: false, error: error.message || 'Error interno del servidor.' };
  }
}
