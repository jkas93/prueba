import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setProjectBaseline } from '@/app/actions/baseline';
import { getProjectRole } from '@/lib/auth/guards';
import { adminDb } from '@/lib/firebase/server';

vi.mock('@/lib/auth/guards', () => ({
  getProjectRole: vi.fn()
}));

vi.mock('@/lib/firebase/server', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn()
        }))
      }))
    })),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue({})
    }))
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

describe('setProjectBaseline Server Action', () => {
  const projectId = 'test-project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Debe fallar si el usuario no es admin', async () => {
    (getProjectRole as any).mockResolvedValue('viewer');

    const result = await setProjectBaseline(projectId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tienes permiso');
  });

  it('2. Debe tener éxito si el usuario es admin y hay actividades', async () => {
    (getProjectRole as any).mockResolvedValue('admin');
    const mockDocs = [
      { id: '1', ref: {}, data: () => ({ start_date: '2026-01-01', end_date: '2026-01-05' }) },
      { id: '2', ref: {}, data: () => ({ start_date: '2026-02-01', end_date: '2026-02-05' }) }
    ];

    const collectionSpy = vi.spyOn(adminDb, 'collection' as any).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: mockDocs
      })
    } as any);

    const result = await setProjectBaseline(projectId);

    expect(result.success).toBe(true);
    expect(adminDb.batch).toHaveBeenCalled();
  });

  it('3. Debe manejar proyectos sin actividades', async () => {
    (getProjectRole as any).mockResolvedValue('admin');

    vi.spyOn(adminDb, 'collection' as any).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: true,
        docs: []
      })
    } as any);

    const result = await setProjectBaseline(projectId);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No hay actividades');
  });
});
