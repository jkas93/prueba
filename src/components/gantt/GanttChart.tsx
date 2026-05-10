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

  const { createTask, updateTask, deleteTask, reorderSiblings } = useGanttCRUD();
  const { syncMarkers } = useGanttMarkers();

  const onEditTaskRef = useRef(onEditTask);
  useEffect(() => { onEditTaskRef.current = onEditTask; }, [onEditTask]);

  // Keep a ref to latest tasksData so init() can access it
  const tasksDataRef = useRef(tasksData);
  useEffect(() => { tasksDataRef.current = tasksData; }, [tasksData]);

  // Init Gantt (Runs once)
  useEffect(() => {
    if (ganttInitialized.current || !containerRef.current) return;

    const init = async () => {
      const ganttModule = await import('dhtmlx-gantt');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gantt: any = ganttModule.gantt || ganttModule.default || ganttModule;

      gantt.plugins({ marker: true });

      // Apply localization and configs
      gantt.locale.date = GANTT_LOCALE_ES.date;
      gantt.locale.labels = GANTT_LOCALE_ES.labels;

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

      gantt.ext.zoom.init(getGanttZoomConfig(gantt));
      gantt.templates.task_class = getTaskClass;
      gantt.config.columns = GANTT_COLUMNS(readonly);

      gantt.init(containerRef.current);
      ganttRef.current = gantt;
      // Attach to window so the public export API (api.js) can use it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).gantt = gantt;

      // Task Clicks
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
      });

      gantt.attachEvent("onBeforeTaskMove", (id: string, parent: string) => {
        const task = gantt.getTask(id) as GanttTaskEntity;
        const parentTask = parent && gantt.isTaskExists(parent) ? gantt.getTask(parent) as GanttTaskEntity : null;
        if (task.db_type === 'partida' && parent) return false;
        if (task.db_type === 'item' && (!parentTask || parentTask.db_type !== 'partida')) return false;
        if (task.db_type === 'activity' && (!parentTask || parentTask.db_type !== 'item')) return false;
        return true;
      });

      gantt.attachEvent("onAfterTaskAdd", async (id: string, task: GanttTaskEntity) => {
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
      });

      gantt.attachEvent("onAfterTaskUpdate", async (id: string, task: GanttTaskEntity) => {
        if (!task.db_id || !task.db_type) return;
        const updates: Record<string, unknown> = { name: task.text };
        
        if (task.db_type === 'activity') {
          const sd = task.start_date || new Date();
          const edRaw = task.end_date || new Date();
          const edInclusive = subDays(edRaw, 1);
          updates.start_date = format(sd, 'yyyy-MM-dd');
          updates.end_date = format(edInclusive, 'yyyy-MM-dd');
          updates.weight = typeof task.weight === 'string' ? parseFloat(task.weight) : (task.weight || 1);
        }

        await updateTask(task.db_type, task.db_id, updates);
      });

      gantt.attachEvent("onAfterTaskDelete", async (id: string, task: GanttTaskEntity) => {
         if (task.db_id && task.db_type) {
           await deleteTask(task.db_type, task.db_id);
         }
      });

      gantt.attachEvent("onAfterTaskMove", async (id: string, parent: string) => {
        const task = gantt.getTask(id);
        const siblings = gantt.getChildren(parent);
        const childIds = siblings.map((sid: string) => gantt.getTask(sid).db_id).filter(Boolean);
        await reorderSiblings(task.db_type, childIds);
      });

      gantt.attachEvent("onGanttScroll", (left: number, top: number) => {
        if (containerRef.current) {
          containerRef.current.style.setProperty('--scroll-top', `${top}px`);
        }
      });

      // Load initial data inside init to avoid race condition
      gantt.ext.zoom.setLevel(zoomLevel);
      gantt.parse({ data: tasksDataRef.current, links: [] });
      await syncMarkers(gantt, projectId);
      gantt.render();

      // Mark as initialized AFTER data is loaded
      ganttInitialized.current = true;

      // Show date initially
      setTimeout(() => { if (ganttRef.current) ganttRef.current.showDate(new Date()) }, 100);
    };

    init();
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

  // Handle Data Parsing (preserves open state) — only for subsequent updates
  useEffect(() => {
    if (ganttInitialized.current && ganttRef.current) {
      const gantt = ganttRef.current;
      
      const openTasks = new Set<string>();
      gantt.eachTask((t: GanttTaskEntity) => { if(t.$open) openTasks.add(t.id); });
      
      gantt.clearAll();
      gantt.parse({ data: tasksData, links: [] });
      
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
