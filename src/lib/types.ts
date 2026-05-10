// =============================================================
// TypeScript type definitions for the Cronograma database
// =============================================================

export type SystemRole = 'user' | 'superadmin';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  system_role: SystemRole;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  owner_id: string;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export interface Partida {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Item {
  id: string;
  partida_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Activity {
  id: string;
  item_id: string;
  name: string;
  start_date: string;
  end_date: string;
  baseline_start?: string | null;
  baseline_end?: string | null;
  weight: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DailyProgress {
  id: string;
  activity_id: string;
  date: string;
  progress_percent: number;
  notes: string | null;
  photo_urls?: string[] | null;
  created_by: string | null;
  created_at: string;
  has_restriction?: boolean;
  restriction_reason?: string | null;
}

export interface Alert {
  id: string;
  project_id: string;
  activity_id: string | null;
  type: 'schedule_delay' | 'progress_deviation';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
}

// =============================================================
// Extended types (with joined data)
// =============================================================

export interface ActivityWithProgress extends Activity {
  daily_progress: DailyProgress[];
}

export interface ItemWithActivities extends Item {
  activities: Activity[];
}

export interface PartidaWithItems extends Partida {
  items: ItemWithActivities[];
}

export interface ProjectWithDetails extends Project {
  partidas: PartidaWithItems[];
  owner: Profile;
}

// =============================================================
// S-Curve types
// =============================================================

export interface SCurvePoint {
  date: string;
  planned: number;     // Cumulative planned progress 0–100
  actual?: number;      // Cumulative actual progress 0–100
  deviation: number;   // Difference (actual - planned)
}

export interface SCurveData {
  points: SCurvePoint[];
  totalWeight: number;
  currentPlanned: number;
  currentActual: number;
  spiIndex: number;    // Schedule Performance Index
  latestProgressDate?: string | null;
}

// =============================================================
// Gantt chart types (for dhtmlx-gantt integration)
// =============================================================

export interface GanttTask {
  id: string;
  text: string;
  start_date: string;
  end_date: string;
  duration?: number;
  parent: string;
  type?: 'project' | 'task';
  weight?: number;
  progress?: number;
  open?: boolean;
  // Custom fields
  db_type?: 'partida' | 'item' | 'activity';
  db_id?: string;
}

export interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: string;
}

// =============================================================
// Public Progress View types
// =============================================================

export interface ActivityProgress {
  id: string;
  name: string;
  progressToday: number;
  notes: string | null;
  photos: string[];
  hasRestriction: boolean;
  restrictionReason: string | null;
  accumulatedProgress?: number; // accumulated % (0-100)
}

export interface ItemProgress {
  id: string;
  name: string;
  activities: ActivityProgress[];
  accumulatedPercent?: number; // accumulated relative to its weight
}

export interface PartidaProgress {
  id: string;
  name: string;
  items: ItemProgress[];
  accumulatedPercent?: number; // accumulated relative to its weight
}

