import { useCallback } from 'react';
import { useFirebase } from './useFirebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';

export function useGanttMarkers() {
  const { db } = useFirebase();

  /**
   * Carga los hitos del proyecto y agrega tanto los hitos como el marcador de "HOY".
   * Este método maneja las limpiezas de marcadores previamente inyectados
   * resolviendo el bug de las líneas rojas duplicadas del diagnóstico.
   */
  const syncMarkers = useCallback(async (ganttInstance: Record<string, unknown>, projectId: string) => {
    if (!ganttInstance || !projectId) return;

    try {
      // 1. Limpiar todos los marcadores existentes para asegurar idempotencia
      const getMarkers = typeof ganttInstance.getMarkers === 'function' ? ganttInstance.getMarkers.bind(ganttInstance) : null;
      const deleteMarker = typeof ganttInstance.deleteMarker === 'function' ? ganttInstance.deleteMarker.bind(ganttInstance) : null;
      const addMarker = typeof ganttInstance.addMarker === 'function' ? ganttInstance.addMarker.bind(ganttInstance) : null;
      const renderMarkers = typeof ganttInstance.renderMarkers === 'function' ? ganttInstance.renderMarkers.bind(ganttInstance) : null;

      const existingMarkers = getMarkers ? getMarkers() : [];
      existingMarkers.forEach((m: {id: string}) => {
        if (deleteMarker) deleteMarker(m.id);
      });

      // 2. Fetch milestones from Firebase (note: project_milestones wasn't in the migration script, but let's query it anyway)
      let milestones: any[] = [];
      try {
        const q = query(collection(db, 'project_milestones'), where('project_id', '==', projectId));
        const snapshot = await getDocs(q);
        milestones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.error('Error fetching milestones for markers:', error);
      }

      // 3. Agregar marcador Hoy
      // Usamos la fecha y hora actual exacta local de Lima para que la línea roja sea precisa
      const today = new Date();

      if (addMarker) {
        try {
          addMarker({
            id: 'today_marker_' + Date.now(),
            start_date: today,
            css: 'today',
            text: 'HOY',
            title: `Hoy: ${format(today, 'dd/MM/yyyy')}`
          });
        } catch (err) {
          console.warn('Marker plugin not ready, skipping today marker:', err);
        }
      }

      // 4. Agregar marcadores Hitos
      if (milestones && milestones.length > 0) {
        milestones.forEach((ms: any) => {
          // Parseamos la fecha evitando el salto a UTC mediante el asenso a mediodía local
          let msDate = new Date(ms.date);
          if (ms.date.includes('-')) {
            const parts = ms.date.split('T')[0].split('-');
            if (parts.length === 3) {
              msDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
            }
          }
          
          if (addMarker) {
            try {
              addMarker({
                id: `milestone_${ms.id}`,
                start_date: msDate,
                css: 'project-milestone',
                text: ms.name,
                title: `${ms.name}: ${format(msDate, 'dd/MM/yyyy')}`
              });
            } catch (err) {
              console.warn('Marker plugin not ready, skipping milestone marker:', err);
            }
          }
        });
      }

      // 5. Refrescar el render de los marcadores
      if (renderMarkers) renderMarkers();

    } catch (err) {
      console.error('Failed to sync markers:', err);
    }
  }, [db]);

  return {
    syncMarkers
  };
}
