'use server';

import { adminDb } from '@/lib/firebase/server';
import { evaluateAlerts, saveAlerts } from '@/lib/alerts';
import type { Activity, DailyProgress } from '@/lib/types';

type GanttElement = {
  id: string;
  type: 'partida' | 'item' | 'activity';
  project_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  weight?: number;
  parent_id?: string | null;
  sort_order?: number;
};

export async function triggerProjectAlerts(projectId: string) {
  // 1. Fetch project
  const projectSnap = await adminDb.collection('projects').doc(projectId).get();
  if (!projectSnap.exists) return;
  const project = projectSnap.data() as { start_date: string; end_date: string };

  // 2. Fetch all gantt elements and extract activities
  const ganttSnap = await adminDb
    .collection('gantt_elements')
    .where('project_id', '==', projectId)
    .get();

  const ganttElements = ganttSnap.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as GanttElement)
  );

  const activities = ganttElements.filter(
    (e): e is GanttElement & { type: 'activity' } => e.type === 'activity'
  ) as unknown as Activity[];

  // 3. Fetch all daily progress (chunk by 10 due to Firestore 'in' limit)
  const activityIds = activities.map((a) => (a as Activity).id);

  let dailyProgress: DailyProgress[] = [];
  if (activityIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < activityIds.length; i += 10) {
      chunks.push(activityIds.slice(i, i + 10));
    }

    const progressPromises = chunks.map((chunk) =>
      adminDb.collection('daily_progress').where('activity_id', 'in', chunk).get()
    );

    const progressSnaps = await Promise.all(progressPromises);
    dailyProgress = progressSnaps.flatMap((snap) =>
      snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as unknown as DailyProgress))
    );
  }

  // 4. Evaluate alerts
  const { newAlerts } = evaluateAlerts(
    projectId,
    project.start_date,
    project.end_date,
    activities,
    dailyProgress
  );

  // 5. Save if any new
  if (newAlerts.length > 0) {
    await saveAlerts(newAlerts);
  }
}
