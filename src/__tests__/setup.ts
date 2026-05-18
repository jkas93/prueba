import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn()
    };
  },
  usePathname() {
    return '';
  },
  useSearchParams() {
    return new URLSearchParams();
  }
}));

// Polyfill for ResizeObserver if needed by Recharts/Gantt
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Worker for SCurve testing
global.Worker = class {
  onmessage: (e: any) => void = () => {};
  postMessage(data: any) {
    // Basic mock logic to return something successfull
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            success: true,
            result: {
              points: [{ date: '2026-03-10', planned: 50, actual: 45, deviation: -5 }],
              currentPlanned: 50,
              currentActual: 45,
              spiIndex: 0.9,
              latestProgressDate: '2026-03-10'
            }
          }
        });
      }
    }, 10);
  }
  terminate() {}
} as any;

// Mock Firebase
vi.mock('@/lib/firebase/client', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' },
    onAuthStateChanged: vi.fn(),
  },
  db: {},
  app: {},
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}));
