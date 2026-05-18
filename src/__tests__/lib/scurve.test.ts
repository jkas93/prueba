import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateSCurve, getDeviationSeverity, DEVIATION_THRESHOLDS } from '@/lib/scurve';
import { sampleActivities, sampleDailyProgress } from '../fixtures/sampleData';
import type { Activity, DailyProgress } from '@/lib/types';

// ── Helpers ────────────────────────────────────────────────────
function makeActivity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    id: overrides.id,
    item_id: 'item-1',
    name: 'Test Activity',
    start_date: overrides.start_date ?? '2025-01-06',
    end_date:   overrides.end_date   ?? '2025-01-11',
    weight:     overrides.weight     ?? 10,
    sort_order: 0,
    baseline_start: null,
    baseline_end:   null,
    created_at: '',
    updated_at: '',
  };
}

function makeProgress(overrides: {
  id: string; activity_id: string; date: string; progress_percent: number;
}): DailyProgress {
  return {
    id: overrides.id,
    activity_id: overrides.activity_id,
    date: overrides.date,
    progress_percent: overrides.progress_percent,
    notes: null, photo_urls: null, created_by: null,
    created_at: '', has_restriction: false, restriction_reason: null,
  };
}

// ── calculateSCurve baseline ───────────────────────────────────
describe('S-Curve EVM Engine - Baseline Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Proyecto vacío retorna defaults seguros', () => {
    const result = calculateSCurve('2026-03-01', '2026-03-31', [], []);
    expect(result.points).toEqual([]);
    expect(result.totalWeight).toBe(0);
    expect(result.spiIndex).toBe(1);
  });

  it('2. Una actividad sin progreso → currentActual es 0', () => {
    const result = calculateSCurve('2026-03-01', '2026-03-05', [sampleActivities[0]], []);
    expect(result.totalWeight).toBe(40);
    expect(result.currentActual).toBe(0);
    expect(result.currentPlanned).toBeGreaterThan(0);
    expect(result.spiIndex).toBe(0);
  });

  it('3. Proyecto con datos completos calcula planificado y real', () => {
    const result = calculateSCurve('2026-03-01', '2026-03-15', sampleActivities, sampleDailyProgress);
    expect(result.totalWeight).toBe(100);
    expect(result.currentActual).toBe(46);
    expect(result.latestProgressDate).toBe('2026-03-06');
    const maxActual = Math.max(
      ...result.points.filter((p) => p.actual !== undefined).map((p) => p.actual!)
    );
    expect(maxActual).toBe(46);
  });

  it('10. Previene divisiones por cero con peso total 0', () => {
    const actCero = { ...sampleActivities[0], weight: 0 };
    const result = calculateSCurve('2026-03-01', '2026-03-05', [actCero], []);
    expect(result.totalWeight).toBe(0);
    expect(result.currentPlanned).toBe(0);
    expect(result.spiIndex).toBe(1);
  });
});

// ── calculateSCurve extended ───────────────────────────────────
describe('calculateSCurve — extended coverage', () => {
  it('genera un punto por día calendario en el rango', () => {
    const a = makeActivity({ id: 'a1', start_date: '2025-01-06', end_date: '2025-01-08' });
    const result = calculateSCurve('2025-01-06', '2025-01-08', [a], []);
    expect(result.points).toHaveLength(3);
    expect(result.points[0].date).toBe('2025-01-06');
    expect(result.points[2].date).toBe('2025-01-08');
  });

  it('el progreso planificado llega a 100% al final del rango', () => {
    const a = makeActivity({ id: 'a1', start_date: '2025-01-06', end_date: '2025-01-11', weight: 60 });
    const result = calculateSCurve('2025-01-06', '2025-01-11', [a], []);
    const last = result.points[result.points.length - 1];
    expect(last.planned).toBe(100);
  });

  it('no supera 100% en ningún punto del planned', () => {
    const a = makeActivity({ id: 'a1', start_date: '2025-01-06', end_date: '2025-01-06', weight: 100 });
    const result = calculateSCurve('2025-01-06', '2025-01-10', [a], []);
    result.points.forEach((p) => expect(p.planned).toBeLessThanOrEqual(100));
  });

  it('acumula progreso real correctamente en la fecha del registro', () => {
    const a = makeActivity({ id: 'a1', start_date: '2025-01-06', end_date: '2025-01-11', weight: 100 });
    const p = makeProgress({ id: 'p1', activity_id: 'a1', date: '2025-01-06', progress_percent: 50 });
    const result = calculateSCurve('2025-01-06', '2025-01-11', [a], [p]);
    const jan6 = result.points.find((pt) => pt.date === '2025-01-06');
    expect(jan6?.actual).toBe(50);
  });

  it('totalWeight suma los pesos de todas las actividades', () => {
    const a1 = makeActivity({ id: 'a1', weight: 30, start_date: '2025-01-06', end_date: '2025-01-07' });
    const a2 = makeActivity({ id: 'a2', weight: 70, start_date: '2025-01-06', end_date: '2025-01-07' });
    const result = calculateSCurve('2025-01-06', '2025-01-07', [a1, a2], []);
    expect(result.totalWeight).toBe(100);
  });

  it('extiende el timeline cuando las actividades exceden las fechas del proyecto', () => {
    const a = makeActivity({ id: 'a1', start_date: '2024-12-30', end_date: '2025-01-15' });
    const result = calculateSCurve('2025-01-01', '2025-01-10', [a], []);
    expect(result.points[0].date).toBe('2024-12-30');
    expect(result.points[result.points.length - 1].date).toBe('2025-01-15');
  });

  it('actual es undefined cuando no hay registros de progreso', () => {
    const a = makeActivity({ id: 'a1', start_date: '2025-01-06', end_date: '2025-01-10' });
    const result = calculateSCurve('2025-01-06', '2025-01-10', [a], []);
    result.points.forEach((p) => expect(p.actual).toBeUndefined());
  });
});

// ── getDeviationSeverity ───────────────────────────────────────
describe('getDeviationSeverity', () => {
  it('retorna null para desviaciones bajo el umbral INFO', () => {
    expect(getDeviationSeverity(0)).toBeNull();
    expect(getDeviationSeverity(-2)).toBeNull();
    expect(getDeviationSeverity(4.9)).toBeNull();
  });

  it('retorna "info" en el umbral INFO', () => {
    expect(getDeviationSeverity(DEVIATION_THRESHOLDS.INFO)).toBe('info');
    expect(getDeviationSeverity(-DEVIATION_THRESHOLDS.INFO)).toBe('info');
  });

  it('retorna "warning" en el umbral WARNING', () => {
    expect(getDeviationSeverity(DEVIATION_THRESHOLDS.WARNING)).toBe('warning');
    expect(getDeviationSeverity(-DEVIATION_THRESHOLDS.WARNING)).toBe('warning');
  });

  it('retorna "critical" en y sobre el umbral CRITICAL', () => {
    expect(getDeviationSeverity(DEVIATION_THRESHOLDS.CRITICAL)).toBe('critical');
    expect(getDeviationSeverity(-50)).toBe('critical');
  });
});

// ── DEVIATION_THRESHOLDS valores ───────────────────────────────
describe('DEVIATION_THRESHOLDS', () => {
  it('tiene los valores correctos', () => {
    expect(DEVIATION_THRESHOLDS.INFO).toBe(5);
    expect(DEVIATION_THRESHOLDS.WARNING).toBe(10);
    expect(DEVIATION_THRESHOLDS.CRITICAL).toBe(20);
  });
});
