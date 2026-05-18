import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePulseSave } from '@/components/project/pulse/usePulseSave';
import { EnhancedPartida, EditedValues } from '@/components/project/pulse/types';

// Mock Router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

describe('usePulseSave Hook - Business Logic Tests', () => {
  const projectId = 'test-id';
  const selectedDate = '2026-03-10';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Error si no hay cambios', async () => {
    const { result } = renderHook(() => usePulseSave({ 
      projectId, selectedDate, activeActivitiesByPartida: [], onSaveSuccess: vi.fn() 
    }));

    await act(async () => {
      await result.current.handleSaveAll({});
    });

    expect(result.current.error).toBe('No hay cambios para guardar.');
  });

  it('2. Validación: No permite progreso > 100%', async () => {
    const partida: EnhancedPartida = {
      id: 'p1', name: 'P1', sort_order: 0, created_at: '', project_id: 'test-id',
      items: [{
        id: 'i1', name: 'I1', sort_order: 0, created_at: '', partida_id: 'p1',
        activities: [{
          id: 'a1', name: 'A1', item_id: 'i1', start_date: '2026-03-01', end_date: '2026-03-31', 
          weight: 100, sort_order: 0, totalProgress: 90, existingTodayPercent: 0,
          existingTodayNotes: '', existingTodayPhotos: [], existingTodayRestriction: false,
          existingTodayRestrictionReason: '', created_at: '', updated_at: ''
        }]
      }]
    };

    const { result } = renderHook(() => usePulseSave({ 
      projectId, selectedDate, activeActivitiesByPartida: [partida], onSaveSuccess: vi.fn() 
    }));

    const edits: EditedValues = { 
      'a1': { percent: '20', notes: '', files: [], hasRestriction: false, restrictionReason: '' } 
    };

    await act(async () => {
      await result.current.handleSaveAll(edits);
    });

    expect(result.current.error).toContain('Acumulado > 100%');
  });
});
