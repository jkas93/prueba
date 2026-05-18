import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SCurveChart } from '@/components/charts/SCurveChart';
import { sampleProject, samplePartidas, sampleDailyProgress } from '../fixtures/sampleData';
import React from 'react';

// Mock Recharts to avoid issues in JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: '100%', height: '400px' }}>{children}</div>
  };
});

describe('SCurveChart - Component Tests', () => {
  it('1. Renderiza estado vacío cuando no hay actividades', () => {
    render(
      <SCurveChart 
        project={sampleProject} 
        partidas={[]} 
        dailyProgress={[]} 
        milestones={[]} 
      />
    );
    expect(screen.getByText(/Sin datos para la Curva S/i)).toBeInTheDocument();
  });

  it('2. Renderiza métricas principales cuando hay datos', async () => {
    render(
      <SCurveChart 
        project={sampleProject} 
        partidas={samplePartidas} 
        dailyProgress={sampleDailyProgress} 
        milestones={[]} 
      />
    );

    expect(await screen.findByText(/Avance Planificado/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(await screen.findByText(/Avance Real/i)).toBeInTheDocument();
    expect(await screen.findByText(/SPI \(Índice\)/i)).toBeInTheDocument();
  });

  it('3. Muestra el botón de exportar', async () => {
    render(
      <SCurveChart 
        project={sampleProject} 
        partidas={samplePartidas} 
        dailyProgress={sampleDailyProgress} 
        milestones={[]} 
      />
    );
    expect(await screen.findByText(/Exportar PNG/i)).toBeInTheDocument();
  });
});
