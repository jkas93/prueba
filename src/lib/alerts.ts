import { adminDb } from '@/lib/firebase/server';
import type { Activity, DailyProgress, Alert } from './types';
import { calculateSCurve, getDeviationSeverity } from './scurve';
import { format } from 'date-fns';

// =============================================================
// ALERTS ENGINE
// Evaluates project progress and generates alert records
// =============================================================

interface AlertCheckResult {
  newAlerts: Omit<Alert, 'id' | 'created_at'>[];
  spiIndex: number;
  currentDeviation: number;
}

export function evaluateAlerts(
  projectId: string,
  projectStartDate: string,
  projectEndDate: string,
  activities: Activity[],
  dailyProgress: DailyProgress[]
): AlertCheckResult {
  const scurveData = calculateSCurve(
    projectStartDate,
    projectEndDate,
    activities,
    dailyProgress
  );

  const newAlerts: Omit<Alert, 'id' | 'created_at'>[] = [];
  const today = format(new Date(), 'yyyy-MM-dd');

  // 1. Overall project deviation alert
  const overallDeviation = scurveData.currentActual - scurveData.currentPlanned;
  const overallSeverity = getDeviationSeverity(overallDeviation);

  if (overallSeverity && overallDeviation < 0) {
    newAlerts.push({
      project_id: projectId,
      activity_id: null,
      type: 'progress_deviation',
      message: `El proyecto tiene un retraso del ${Math.abs(overallDeviation).toFixed(1)}% respecto al plan. ` +
        `Avance planificado: ${scurveData.currentPlanned.toFixed(1)}%, ` +
        `Avance real: ${scurveData.currentActual.toFixed(1)}%. ` +
        `SPI: ${scurveData.spiIndex.toFixed(2)}`,
      severity: overallSeverity,
      is_read: false,
    });
  }

  // 2. Per-activity schedule delay alerts
  for (const activity of activities) {
    const activityEnd = new Date(activity.end_date);
    const todayDate = new Date(today);

    if (todayDate > activityEnd) {
      // Check if activity is complete
      const activityProgress = dailyProgress
        .filter((dp) => dp.activity_id === activity.id)
        .reduce((sum, dp) => sum + Number(dp.progress_percent), 0);

      if (activityProgress < 100) {
        const daysLate = Math.ceil(
          (todayDate.getTime() - activityEnd.getTime()) / (1000 * 60 * 60 * 24)
        );
        newAlerts.push({
          project_id: projectId,
          activity_id: activity.id,
          type: 'schedule_delay',
          message: `La actividad "${activity.name}" tiene ${daysLate} día(s) de retraso. ` +
            `Fecha fin planificada: ${activity.end_date}. Avance: ${activityProgress.toFixed(1)}%`,
          severity: daysLate > 7 ? 'critical' : daysLate > 3 ? 'warning' : 'info',
          is_read: false,
        });
      }
    }
  }

  // 3. Daily restriction alerts
  dailyProgress.filter(dp => dp.has_restriction && dp.date === today).forEach(dp => {
    const activity = activities.find(a => a.id === dp.activity_id);
    if (activity) {
      newAlerts.push({
        project_id: projectId,
        activity_id: activity.id,
        type: 'schedule_delay',
        message: `Restricción reportada en "${activity.name}": ${dp.restriction_reason || 'Sin detalles'}`,
        severity: 'critical',
        is_read: false,
      });
    }
  });

  return {
    newAlerts,
    spiIndex: scurveData.spiIndex,
    currentDeviation: overallDeviation,
  };
}

export async function saveAlerts(
  alerts: Omit<Alert, 'id' | 'created_at'>[]
): Promise<void> {
  if (alerts.length === 0) return;
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch alerts for today
  const alertTypes = Array.from(new Set(alerts.map(a => a.type)));
  
  const existingAlertsSnapshot = await adminDb
    .collection('alerts')
    .where('project_id', '==', alerts[0].project_id)
    .where('type', 'in', alertTypes)
    .get();

  const existingAlerts = existingAlertsSnapshot.docs
    .map((docSnap) => docSnap.data() as { type: string; activity_id: string | null; created_at: string })
    .filter((a) => new Date(a.created_at) >= new Date(`${today}T00:00:00`));

  const existingSet = new Set(
    existingAlerts.map((a) => `${a.type}:${a.activity_id || 'global'}`)
  );

  const newAlerts = alerts.filter((a) => {
    const key = `${a.type}:${a.activity_id || 'global'}`;
    return !existingSet.has(key);
  });

  if (newAlerts.length > 0) {
    const batch = adminDb.batch();
    newAlerts.forEach(alert => {
      const docRef = adminDb.collection('alerts').doc();
      batch.set(docRef, {
        ...alert,
        created_at: new Date().toISOString()
      });
    });
    await batch.commit();
  }
}
