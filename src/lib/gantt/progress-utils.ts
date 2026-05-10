import type { DailyProgress, PartidaWithItems, Activity } from '@/lib/types';
import { toGanttEndDate } from './date-utils';
import type { GanttTaskData } from './types';

/**
 * Pre-calcula un mapa de progresos diarios agrupados por ID de actividad.
 * Evita filtros anidados en O(N^2) durante la inicialización del Gantt.
 */
export function buildProgressMap(dailyProgress: DailyProgress[]): Map<string, DailyProgress[]> {
  const progressMap = new Map<string, DailyProgress[]>();
  
  if (!dailyProgress || !Array.isArray(dailyProgress)) return progressMap;

  for (const dp of dailyProgress) {
    if (!dp || !dp.activity_id) continue;
    
    const existing = progressMap.get(dp.activity_id) || [];
    existing.push(dp);
    progressMap.set(dp.activity_id, existing);
  }
  
  return progressMap;
}

/**
 * Calcula el progreso porcentual total (entre 0 y 1) de una actividad.
 */
export function calculateActivityProgress(progressEntries: DailyProgress[]): number {
  if (!progressEntries || progressEntries.length === 0) return 0;
  
  const total = progressEntries.reduce((sum, dp) => sum + (Number(dp.progress_percent) || 0), 0);
  return Math.min(total / 100, 1);
}

/**
 * Convierte la estructura anidada de partidas -> items -> activities 
 * en una estructura plana (flat array) para inyectar en dhtmlx-gantt.
 */
export function buildTasksFromPartidas(
  partidas: PartidaWithItems[], 
  progressMap: Map<string, DailyProgress[]>
): GanttTaskData[] {
  const tasks: GanttTaskData[] = [];
  
  if (!partidas || !Array.isArray(partidas)) return tasks;

  const sortedPartidas = [...partidas].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  for (const partida of sortedPartidas) {
    tasks.push({
      id: `p_${partida.id}`,
      text: partida.name,
      start_date: null,
      duration: 0,
      open: true,
      db_type: 'partida',
      db_id: partida.id,
      color: '#334155',
      textColor: '#ffffff'
    });

    const sortedItems = [...(partida.items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    for (const item of sortedItems) {
      tasks.push({
        id: `i_${item.id}`,
        text: item.name,
        parent: `p_${partida.id}`,
        start_date: null,
        duration: 0,
        open: true,
        db_type: 'item',
        db_id: item.id,
        color: '#64748b',
        textColor: '#ffffff'
      });

      // Validamos que existan activities
      const activities = ('activities' in item) ? item.activities as Activity[] : [];
      const sortedActivities = [...activities].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      for (const activity of sortedActivities) {
        if (!activity.start_date) continue; // Salto seguro de actividades defectuosas
        
        const taskProgressLogs = progressMap.get(activity.id) || [];
        const progress = calculateActivityProgress(taskProgressLogs);

        tasks.push({
          id: `a_${activity.id}`,
          text: activity.name,
          parent: `i_${item.id}`,
          start_date: activity.start_date,
          end_date: activity.end_date ? toGanttEndDate(activity.end_date) : null,
          planned_start: activity.baseline_start || null,
          planned_end: activity.baseline_end ? toGanttEndDate(activity.baseline_end) : null,
          weight: activity.weight || 1,
          progress: progress,
          color: '#F7C20E',
          progressColor: '#daa90c',
          db_type: 'activity',
          db_id: activity.id,
        });
      }
    }
  }

  return tasks;
}
