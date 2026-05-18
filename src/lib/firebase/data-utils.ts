/**
 * Shared data-assembly utilities for Firestore gantt_elements.
 *
 * These functions are used across project pages, share pages,
 * and any future consumer that needs to work with hierarchical Gantt data.
 */
import type { PartidaWithItems, Activity } from '@/lib/types';

// ── Local type for raw Firestore documents ──────────────────────
export type GanttElementRaw = {
  id: string;
  type: 'partida' | 'item' | 'activity';
  parent_id: string | null;
  project_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  weight?: number;
  sort_order?: number;
  baseline_start?: string | null;
  baseline_end?: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Builds a hierarchical PartidaWithItems[] tree from a flat array
 * of raw Firestore `gantt_elements` documents.
 *
 * @param elements - Flat list of gantt_elements from Firestore
 * @param projectId - The owning project's ID
 */
export function buildPartidaTree(
  elements: GanttElementRaw[],
  projectId: string
): PartidaWithItems[] {
  const partidas = elements.filter((e) => e.type === 'partida');
  const items    = elements.filter((e) => e.type === 'item');
  const acts     = elements.filter((e) => e.type === 'activity');

  return partidas.map((p) => ({
    id: p.id,
    project_id: projectId,
    name: p.name,
    sort_order: p.sort_order ?? 0,
    created_at: p.created_at ?? '',
    items: items
      .filter((i) => i.parent_id === p.id)
      .map((i) => ({
        id: i.id,
        partida_id: p.id,
        name: i.name,
        sort_order: i.sort_order ?? 0,
        created_at: i.created_at ?? '',
        activities: acts
          .filter((a) => a.parent_id === i.id)
          .map(
            (a): Activity => ({
              id: a.id,
              item_id: i.id,
              name: a.name,
              start_date: a.start_date ?? '',
              end_date: a.end_date ?? '',
              weight: a.weight ?? 1,
              sort_order: a.sort_order ?? 0,
              baseline_start: a.baseline_start ?? null,
              baseline_end: a.baseline_end ?? null,
              created_at: a.created_at ?? '',
              updated_at: a.updated_at ?? '',
            })
          ),
      })),
  }));
}

/**
 * Calculates effective start and end dates for a project,
 * expanding the project range to cover all activity dates.
 *
 * @param projectStartDate - Project's stored start_date (ISO string)
 * @param projectEndDate   - Project's stored end_date (ISO string)
 * @param partidas         - Hierarchical partidas (with nested activities)
 */
export function getEffectiveDates(
  projectStartDate: string,
  projectEndDate: string,
  partidas: PartidaWithItems[]
): { effectiveStart: string; effectiveEnd: string } {
  const allActivities = partidas
    .flatMap((p) => p.items)
    .flatMap((i) => i.activities);

  let effectiveStart = projectStartDate;
  let effectiveEnd   = projectEndDate;

  if (allActivities.length > 0) {
    const actStarts = allActivities.map((a) => a.start_date).filter(Boolean) as string[];
    const actEnds   = allActivities.map((a) => a.end_date).filter(Boolean)   as string[];

    if (actStarts.length > 0) {
      const minStart = [...actStarts].sort()[0];
      if (minStart < effectiveStart) effectiveStart = minStart;
    }
    if (actEnds.length > 0) {
      const maxEnd = [...actEnds].sort().reverse()[0];
      if (maxEnd > effectiveEnd) effectiveEnd = maxEnd;
    }
  }

  return { effectiveStart, effectiveEnd };
}
