import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { PartidaWithItems, DailyProgress, PartidaProgress, ItemProgress, ActivityProgress } from '@/lib/types';

/**
 * Hook para gestionar la lógica del visor de avances diarios.
 * Optimiza el rendimiento mediante el uso de Map para búsquedas O(1)
 * y pre-computación de estadísticas.
 */
export function useProjectProgress(
  partidas: PartidaWithItems[],
  dailyProgress: DailyProgress[] = []
) {
  // 1. Encontrar la fecha inicial (más reciente con progreso o hoy)
  const initialDate = useMemo(() => {
    const validProgress = dailyProgress.filter(dp => 
      Number(dp.progress_percent) > 0 || 
      !!dp.notes || 
      (dp.photo_urls && dp.photo_urls.length > 0) ||
      dp.has_restriction
    );

    if (validProgress.length > 0) {
      const sorted = [...validProgress].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].date;
    }
    return format(new Date(), 'yyyy-MM-dd');
  }, [dailyProgress]);

  const [selectedDate, setSelectedDate] = useState(initialDate);

  // 2. Pre-mapear el progreso diario por fecha y actividad para acceso O(1)
  // Estructura: Map<date, Map<activity_id, DailyProgress>>
  const progressByDateMap = useMemo(() => {
    const mainMap = new Map<string, Map<string, DailyProgress>>();
    
    dailyProgress.forEach((dp) => {
      if (!mainMap.has(dp.date)) {
        mainMap.set(dp.date, new Map<string, DailyProgress>());
      }
      mainMap.get(dp.date)?.set(dp.activity_id, dp);
    });
    
    return mainMap;
  }, [dailyProgress]);

  const dataForSelectedDate = useMemo(() => {
    const dayMap = progressByDateMap.get(selectedDate);
    if (!dayMap) return [];

    const activePartidas: PartidaProgress[] = [];

    partidas.forEach((p) => {
      const itemsWithActivities: ItemProgress[] = [];
      let partidaTotalWeight = 0;
      let partidaAccumulatedGain = 0;
      
      p.items.forEach((item) => {
        let itemTotalWeight = 0;
        let itemAccumulatedGain = 0;
        
        // Calcular el progreso acumulado real del Item hasta la fecha seleccionada
        item.activities.forEach((activity) => {
          const actWeight = Number(activity.weight) || 0;
          itemTotalWeight += actWeight;
          partidaTotalWeight += actWeight;
          
          let actCumulative = 0;
          dailyProgress.forEach(dp => {
            if (dp.activity_id === activity.id && dp.date <= selectedDate) {
              actCumulative += Number(dp.progress_percent);
            }
          });
            
          const clampedCumulative = Math.min(actCumulative, 100);
          const actGain = (clampedCumulative / 100) * actWeight;
          
          itemAccumulatedGain += actGain;
          partidaAccumulatedGain += actGain;
        });

        const itemAccumulatedPercent = itemTotalWeight > 0 ? (itemAccumulatedGain / itemTotalWeight) * 100 : 0;

        const validActivities = item.activities.map((activity) => {
          const todayProgress = dayMap.get(activity.id);
          
          if (!todayProgress) return null;

          // Criterios para mostrar una actividad: progreso, notas, fotos o restricciones
          const hasContent = 
            Number(todayProgress.progress_percent) > 0 || 
            !!todayProgress.notes || 
            (todayProgress.photo_urls && todayProgress.photo_urls.length > 0) ||
            todayProgress.has_restriction;

          if (!hasContent) return null;

          let actCumulative = 0;
          dailyProgress.forEach(dp => {
            if (dp.activity_id === activity.id && dp.date <= selectedDate) {
              actCumulative += Number(dp.progress_percent);
            }
          });

          const actProgress: ActivityProgress = {
            id: activity.id,
            name: activity.name,
            progressToday: todayProgress.progress_percent,
            notes: todayProgress.notes,
            photos: todayProgress.photo_urls || [],
            hasRestriction: todayProgress.has_restriction || false,
            restrictionReason: todayProgress.restriction_reason || '',
            accumulatedProgress: Math.min(actCumulative, 100)
          };
          return actProgress;
        }).filter((a): a is ActivityProgress => a !== null);

        if (validActivities.length > 0) {
          itemsWithActivities.push({ 
            id: item.id,
            name: item.name, 
            activities: validActivities,
            accumulatedPercent: Math.round(itemAccumulatedPercent * 100) / 100
          });
        }
      });

      const partidaAccumulatedPercent = partidaTotalWeight > 0 ? (partidaAccumulatedGain / partidaTotalWeight) * 100 : 0;

      if (itemsWithActivities.length > 0) {
        activePartidas.push({ 
          id: p.id,
          name: p.name, 
          items: itemsWithActivities,
          accumulatedPercent: Math.round(partidaAccumulatedPercent * 100) / 100
        });
      }
    });

    return activePartidas;
  }, [partidas, progressByDateMap, selectedDate, dailyProgress]);

  // 4. Calcular estadísticas de resumen
  const stats = useMemo(() => {
    let photosCount = 0;
    let restrictionsCount = 0;
    let activitiesCount = 0;

    dataForSelectedDate.forEach(p => {
      p.items.forEach((i) => {
        i.activities.forEach((a) => {
          activitiesCount++;
          photosCount += a.photos.length;
          if (a.hasRestriction) restrictionsCount++;
        });
      });
    });

    return { activitiesCount, photosCount, restrictionsCount };
  }, [dataForSelectedDate]);

  // 5. Utilidades de navegación
  const changeDate = useCallback((days: number) => {
    const current = parseISO(selectedDate);
    const next = days > 0 ? addDays(current, days) : subDays(current, Math.abs(days));
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  }, [selectedDate]);

  const isToday = useMemo(() => {
    return selectedDate === format(new Date(), 'yyyy-MM-dd');
  }, [selectedDate]);

  return {
    selectedDate,
    setSelectedDate,
    dataForSelectedDate,
    stats,
    changeDate,
    isToday
  };
}
