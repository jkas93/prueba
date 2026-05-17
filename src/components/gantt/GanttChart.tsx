import { useEffect, useRef } from 'react';
import { useGanttCRUD } from '@/hooks/useGanttCRUD';
import { useGanttMarkers } from '@/hooks/useGanttMarkers';
import { format, subDays } from 'date-fns';
import { GanttTaskData, GanttDbType } from '@/lib/gantt/types';
import { GANTT_LOCALE_ES, getGanttZoomConfig, getTaskClass, GANTT_COLUMNS } from '@/lib/gantt/config';

export interface TaskEditDetails {
  taskId: string;
  dbType: GanttDbType | null;
  dbId: string;
  name: string;
  startDate: string;
  endDate: string;
  weight: string;
  progress: number;
}

export interface GanttTaskEntity extends Record<string, unknown> {
  id: string;
  text: string;
  start_date: Date;
  end_date: Date;
  db_id?: string;
  db_type: GanttDbType;
  parent: string | number;
  weight?: number;
  progress?: number;
  $editing?: boolean;
}

interface GanttChartProps {
  projectId: string;
  tasksData: GanttTaskData[];
  readonly: boolean;
  zoomLevel: string;
  onEditTask: (taskDetails: TaskEditDetails) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ganttRef: React.MutableRefObject<any>;
}

export function GanttChart({
  projectId,
  tasksData,
  readonly,
  zoomLevel,
  onEditTask,
  ganttRef,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttInitialized = useRef(false);

  // ──────────────────────────────────────────────────────────────
  // Guard flags:
  //   isParsingRef  — blocks all CRUD handlers during bulk parse/clear
  //   isDraggingRef — signals that a drag operation is in progress,
  //                   so onAfterTaskUpdate skips date writes (handled
  //                   by the dedicated onAfterTaskDrag handler instead)
  // ──────────────────────────────────────────────────────────────
  const isParsingRef = useRef(false);
  const isDraggingRef = useRef(false);

  const { createTask, updateTask, deleteTask, reorderSiblings } = useGanttCRUD();
  const { syncMarkers } = useGanttMarkers();

  const onEditTaskRef = useRef(onEditTask);
  useEffect(() => { onEditTaskRef.current = onEditTask; }, [onEditTask]);

  // Keep a ref to latest tasksData so init() can access it
  const tasksDataRef = useRef(tasksData);
  useEffect(() => { tasksDataRef.current = tasksData; }, [tasksData]);

  // ──────────────────────────────────────────────────────────────
  // Init Gantt (Runs once per mount)
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ganttInitialized.current || !containerRef.current) return;

    // Closure-scoped list of DHTMLX event handler IDs so we can
    // deterministically detach every one of them on cleanup.
    let attachedEventIds: string[] = [];
    let isMounted = true;

    const init = async () => {
      const ganttModule = await import('dhtmlx-gantt');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gantt: any = ganttModule.gantt || ganttModule.default || ganttModule;

      // If component unmounted while we were importing, abort.
      if (!isMounted) return;

      gantt.plugins({ marker: true });

      // ── Localization ────────────────────────────────────────
      gantt.locale.date = GANTT_LOCALE_ES.date;
      gantt.locale.labels = GANTT_LOCALE_ES.labels;

      // ── General Config ──────────────────────────────────────
      gantt.config.date_format = '%Y-%m-%d';
      gantt.config.min_column_width = 40;
      gantt.config.scale_height = 60;
      gantt.config.row_height = 32; 
      gantt.config.task_height = 18; 
      gantt.config.readonly = readonly; 
      gantt.config.details_on_dblclick = false;
      gantt.config.details_on_create = false;
      gantt.config.open_tree_initially = true;
      gantt.config.show_progress = true;
      gantt.config.fit_tasks = true;
      gantt.config.drag_resize = true;
      gantt.config.drag_move = true;
      gantt.config.drag_progress = false;
      gantt.config.order_branch = true;
      gantt.config.order_branch_free = true;

      // ── Mobile Touch ────────────────────────────────────────
      gantt.config.touch = true;
      gantt.config.touch_drag = true;
      gantt.config.touch_feedback = true;

      if (typeof window !== 'undefined') {
        if (window.innerWidth < 768) {
          gantt.config.grid_width = window.innerWidth * 0.65;
        } else if (window.innerWidth < 1024) {
          gantt.config.grid_width = window.innerWidth * 0.50;
        } else {
          gantt.config.grid_width = 450;
        }
      }

      gantt.ext.zoom.init(getGanttZoomConfig(gantt));
      gantt.templates.task_class = getTaskClass;
      gantt.config.columns = GANTT_COLUMNS(readonly);

      gantt.init(containerRef.current);
      ganttRef.current = gantt;
      // Attach to window so the public export API (api.js) can use it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gantt = gantt;

      // ────────────────────────────────────────────────────────
      // EVENT HANDLERS
      // Each attachEvent() returns a unique string ID. We store
      // every one so the cleanup function can detach them all,
      // preventing the "double listener" bug caused by React
      // Strict Mode or component re-mounts.
      // ────────────────────────────────────────────────────────

      // ── Task Clicks ─────────────────────────────────────────
      attachedEventIds.push(
        gantt.attachEvent("onTaskClick", (id: string, e: Event) => {
          const target = e.target as HTMLElement;
          const btn = target.closest('.action-btn');
          const saveBtn = target.closest('.inline-save-btn');
          const task = gantt.getTask(id) as GanttTaskEntity;

          if (saveBtn) {
            const row = target.closest('.inline-edit-row');
            const input = row?.querySelector('input') as HTMLInputElement;
            if (input && input.value.trim()) {
              task.text = input.value.trim();
              task.$editing = false;
              gantt.updateTask(id);
            }
            return false;
          }

          if (btn) {
            const action = btn.getAttribute('data-action');
            if (action === 'add') {
              if (task.db_type === 'activity') return false;
              const isPartida = task.db_type === 'partida';
              const newText = isPartida ? 'Nuevo Ítem' : 'Nueva Actividad';
              gantt.createTask({ text: newText, duration: 1 }, id);
              gantt.open(id);
              return false;
            } else if (action === 'edit') {
              const endRaw = task.end_date instanceof Date ? task.end_date : new Date(task.end_date);
              const endStr = task.db_type === 'activity' ? format(subDays(endRaw, 1), 'yyyy-MM-dd') : '';
              const startStr = task.start_date instanceof Date ? format(task.start_date, 'yyyy-MM-dd') : (task.start_date || '');
              onEditTaskRef.current({
                taskId: id,
                dbType: task.db_type || null,
                dbId: task.db_id || '',
                name: task.text || '',
                startDate: task.db_type === 'activity' ? startStr : '',
                endDate: task.db_type === 'activity' ? endStr : '',
                weight: task.weight ? String(task.weight) : '1',
                progress: task.progress || 0,
              });
              return false;
            } else if (action === 'delete') {
              gantt.confirm({
                text: "¿Eliminar permanentemente de la base de datos?",
                ok: "Sí", cancel: "No",
                callback: (result: boolean) => { if (result) gantt.deleteTask(id); }
              });
              return false;
            }
          }

          if (!task.$editing && !readonly && target.closest('.gantt-clickable-text')) {
            gantt.eachTask((t: GanttTaskEntity) => { if (t.$editing) { t.$editing = false; gantt.refreshTask(t.id); } });
            task.$editing = true;
            gantt.refreshTask(id);
            setTimeout(() => {
              const input = document.querySelector(`.inline-edit-input[data-id="${id}"]`) as HTMLInputElement;
              if (input) { input.focus(); input.select(); }
            }, 10);
            return false;
          }
          return true;
        })
      );

      // ── Drag Lifecycle ───────────────────────────────────────
      // onBeforeTaskDrag: set flag so onAfterTaskUpdate knows a drag
      // is in progress and skips its name-only write.
      attachedEventIds.push(
        gantt.attachEvent("onBeforeTaskDrag", () => {
          isDraggingRef.current = true;
          return true;
        })
      );

      // Drag Validation (hierarchy rules)
      attachedEventIds.push(
        gantt.attachEvent("onBeforeTaskMove", (id: string, parent: string) => {
          const task = gantt.getTask(id) as GanttTaskEntity;
          const parentTask = parent && gantt.isTaskExists(parent) ? gantt.getTask(parent) as GanttTaskEntity : null;
          if (task.db_type === 'partida' && parent) return false;
          if (task.db_type === 'item' && (!parentTask || parentTask.db_type !== 'partida')) return false;
          if (task.db_type === 'activity' && (!parentTask || parentTask.db_type !== 'item')) return false;
          return true;
        })
      );

      // ── Create ──────────────────────────────────────────────
      // GUARD: skip when we're bulk-parsing data from the server
      attachedEventIds.push(
        gantt.attachEvent("onAfterTaskAdd", async (id: string, task: GanttTaskEntity) => {
          if (isParsingRef.current) return;

          const parentTask = task.parent && gantt.isTaskExists(String(task.parent)) ? gantt.getTask(String(task.parent)) as GanttTaskEntity : null;
          const siblingsCount = gantt.getChildren(String(task.parent) || '').length;

          let type = 'partida' as GanttDbType;
          if (!parentTask) type = 'partida';
          else if (parentTask.db_type === 'partida') type = 'item';
          else type = 'activity';

          task.db_type = type;

          const result = await createTask(type, projectId, String(task.parent), task, siblingsCount);
          if (result.success && result.data) {
            const row = result.data as { id: string };
            task.db_id = row.id;
            const prefix = type === 'partida' ? 'p' : type === 'item' ? 'i' : 'a';
            gantt.changeTaskId(id, `${prefix}_${row.id}`);
          }
        })
      );

      // ── Update (Name only) ───────────────────────────────────
      // Only saves name changes (from inline editing).
      // Date changes during drags are handled by onAfterTaskDrag below.
      // GUARD: skip during bulk parse OR during a drag (drag has its
      // own handler and also triggers onAfterTaskUpdate internally).
      attachedEventIds.push(
        gantt.attachEvent("onAfterTaskUpdate", async (id: string, task: GanttTaskEntity) => {
          if (isParsingRef.current || isDraggingRef.current) return;
          if (!task.db_id || !task.db_type) return;
          await updateTask(task.db_type, task.db_id, { name: task.text });
        })
      );

      // ── Update (Dates) ───────────────────────────────────────
      // Fires ONCE after a complete drag-resize or drag-move on the
      // timeline. Clears isDraggingRef and persists the new dates.
      attachedEventIds.push(
        gantt.attachEvent("onAfterTaskDrag", async (id: string) => {
          isDraggingRef.current = false;
          if (isParsingRef.current) return;
          const task = gantt.getTask(id) as GanttTaskEntity;
          if (!task.db_id || task.db_type !== 'activity') return;
          const sd = task.start_date || new Date();
          const edRaw = task.end_date || new Date();
          const edInclusive = subDays(edRaw, 1);
          await updateTask('activity', task.db_id, {
            start_date: format(sd, 'yyyy-MM-dd'),
            end_date: format(edInclusive, 'yyyy-MM-dd'),
          });
        })
      );

      // ── Delete ──────────────────────────────────────────────
      // GUARD: skip when we're bulk-parsing data from the server
      attachedEventIds.push(
        gantt.attachEvent("onAfterTaskDelete", async (id: string, task: GanttTaskEntity) => {
          if (isParsingRef.current) return;
          if (task.db_id && task.db_type) {
            await deleteTask(task.db_type, task.db_id);
          }
        })
      );

      // ── Reorder ─────────────────────────────────────────────
      attachedEventIds.push(
        gantt.attachEvent("onAfterTaskMove", async (id: string, parent: string) => {
          if (isParsingRef.current) return;
          const task = gantt.getTask(id);
          const siblings = gantt.getChildren(parent);
          const childIds = siblings.map((sid: string) => gantt.getTask(sid).db_id).filter(Boolean);
          await reorderSiblings(task.db_type, childIds);
        })
      );

      // ── Scroll Position ─────────────────────────────────────
      attachedEventIds.push(
        gantt.attachEvent("onGanttScroll", (left: number, top: number) => {
          if (containerRef.current) {
            containerRef.current.style.setProperty('--scroll-top', `${top}px`);
          }
        })
      );

      // ── Load initial data inside init to avoid race condition ─
      gantt.ext.zoom.setLevel(zoomLevel);

      isParsingRef.current = true;
      gantt.parse({ data: tasksDataRef.current, links: [] });
      isParsingRef.current = false;

      await syncMarkers(gantt, projectId);
      gantt.render();

      // Mark as initialized AFTER data is loaded
      ganttInitialized.current = true;

      // Show today's date initially
      setTimeout(() => { if (ganttRef.current) ganttRef.current.showDate(new Date()) }, 100);
    };

    init();

    // ── Cleanup on unmount ──────────────────────────────────
    // Detach every DHTMLX event to prevent duplicate listeners
    // when the component re-mounts (navigation, React Strict Mode).
    return () => {
      isMounted = false;
      if (ganttRef.current) {
        attachedEventIds.forEach(eventId => {
          try { ganttRef.current.detachEvent(eventId); } catch { /* already detached */ }
        });
      }
      attachedEventIds = [];
      ganttInitialized.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle Zoom and Readonly changes
  useEffect(() => {
    if (ganttInitialized.current && ganttRef.current) {
      ganttRef.current.config.readonly = readonly;
      ganttRef.current.config.columns = GANTT_COLUMNS(readonly);
      ganttRef.current.ext.zoom.setLevel(zoomLevel);
      ganttRef.current.render();
    }
  }, [readonly, zoomLevel, ganttRef]);

  // ──────────────────────────────────────────────────────────────
  // Handle Data Parsing (preserves open state) — subsequent updates
  // The isParsing guard prevents onAfterTaskAdd/Update/Delete from
  // firing during clearAll+parse, which was the root cause of both
  // the "duplicate activity" and "phantom delete" bugs.
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ganttInitialized.current && ganttRef.current) {
      const gantt = ganttRef.current;
      
      // Save open/collapsed state
      const openTasks = new Set<string>();
      gantt.eachTask((t: GanttTaskEntity) => { if(t.$open) openTasks.add(t.id); });
      
      // ── CRITICAL: activate guard before bulk operations ────
      isParsingRef.current = true;

      gantt.clearAll();
      gantt.parse({ data: tasksData, links: [] });

      // ── Deactivate guard ──────────────────────────────────
      isParsingRef.current = false;
      
      // Restore open/collapsed state
      openTasks.forEach((id) => {
        if (gantt.isTaskExists(id)) {
          gantt.open(id);
        }
      });

      syncMarkers(gantt, projectId).then(() => {
        gantt.render();
      });
    }
  }, [tasksData, projectId, syncMarkers, ganttRef]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} className="gantt-root-container" />;
}
