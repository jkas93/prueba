import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUser, updateSystemRole } from '@/app/actions/admin';
import { requireSuperadmin } from '@/lib/auth/guards';
import { adminDb, adminAuth } from '@/lib/firebase/server';

vi.mock('@/lib/auth/guards', () => ({
  requireSuperadmin: vi.fn()
}));

vi.mock('@/lib/firebase/server', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      })),
      where: vi.fn(() => ({
        count: vi.fn(() => ({
          get: vi.fn()
        }))
      }))
    }))
  },
  adminAuth: {
    deleteUser: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

describe('Admin Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. deleteUser debe fallar si el usuario tiene proyectos', async () => {
    (requireSuperadmin as any).mockResolvedValue({});

    // Mock count query
    const countGetMock = vi.fn().mockResolvedValue({ data: () => ({ count: 5 }) });
    vi.spyOn(adminDb, 'collection').mockReturnValue({
      where: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnThis(),
      get: countGetMock
    } as any);

    await expect(deleteUser('user-with-projects')).rejects.toThrow('posee 5 proyecto(s)');
  });

  it('2. updateSystemRole debe llamar a update en firestore', async () => {
    (requireSuperadmin as any).mockResolvedValue({});
    const updateMock = vi.fn().mockResolvedValue({});

    vi.spyOn(adminDb, 'collection').mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true }),
        update: updateMock
      })
    } as any);

    await updateSystemRole('target-uid', 'superadmin');
    expect(updateMock).toHaveBeenCalledWith({ system_role: 'superadmin' });
  });
});
