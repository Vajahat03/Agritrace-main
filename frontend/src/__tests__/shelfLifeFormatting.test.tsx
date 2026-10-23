import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  formatShelfLifeDays,
  formatShelfLifeValue,
  formatShelfLifeInterval,
} from '../lib/formatters';
import { ProduceInspectionWorkspace } from '../components/ProduceInspectionWorkspace';
import { apiClient } from '../lib/apiClient';

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    translateCommodity: (c: string) => c,
  }),
}));

describe('Shelf-Life Display Formatting Utilities', () => {
  it('formats positive values below one day as "Less than 1 day"', () => {
    expect(formatShelfLifeDays(0.96)).toBe('Less than 1 day');
    expect(formatShelfLifeDays(0.48)).toBe('Less than 1 day');
    expect(formatShelfLifeDays(0.1)).toBe('Less than 1 day');
  });

  it('formats exactly one day with singular "1 day"', () => {
    expect(formatShelfLifeDays(1.0)).toBe('1 day');
    expect(formatShelfLifeDays(1.2)).toBe('1 day');
    expect(formatShelfLifeDays(1.49)).toBe('1 day');
  });

  it('formats multi-day shelf life with plural "N days" rounded to whole days', () => {
    expect(formatShelfLifeDays(2.4)).toBe('2 days');
    expect(formatShelfLifeDays(4.8)).toBe('5 days');
    expect(formatShelfLifeDays(7.0)).toBe('7 days');
  });

  it('handles zero, negative, and invalid values gracefully', () => {
    expect(formatShelfLifeDays(0)).toBe('Expired');
    expect(formatShelfLifeDays(-1)).toBe('Expired');
    expect(formatShelfLifeDays(null)).toBe('N/A');
    expect(formatShelfLifeDays(undefined)).toBe('N/A');
    expect(formatShelfLifeDays(NaN)).toBe('N/A');
  });

  it('separates value and singular/plural unit in formatShelfLifeValue', () => {
    expect(formatShelfLifeValue(0.85)).toEqual({ value: 'Less than 1', unit: 'Day' });
    expect(formatShelfLifeValue(1.0)).toEqual({ value: '1', unit: 'Day' });
    expect(formatShelfLifeValue(3.4)).toEqual({ value: '3', unit: 'Days' });
    expect(formatShelfLifeValue(0)).toEqual({ value: '0', unit: 'Days' });
  });

  it('formats prediction intervals honestly without unsupported precision', () => {
    expect(formatShelfLifeInterval(0.48, 1.44)).toBe('< 1 - 1 days');
    expect(formatShelfLifeInterval(2.2, 4.8)).toBe('2 - 5 days');
    expect(formatShelfLifeInterval(null, 5)).toBe('N/A');
  });
});

describe('ProduceInspectionWorkspace Shelf-Life UI Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Less than 1 Day" for sub-day shelf-life predictions in workspace results', async () => {
    const mockInspectResponse = {
      status: 'SUCCESS',
      scan_id: 'scan-subday-01',
      workflow_id: 'wf-subday-01',
      produce_identification: {
        produce_name: 'Bell Pepper',
        crop_type: 'bell_pepper',
        confidence: 0.95,
      },
      freshness_quality: {
        freshness_score_pct: 85,
        freshness_grade: 'Fresh',
        quality_score: 85,
        firmness_index: 8.5,
        color_uniformity_pct: 95,
      },
      shelf_life_prediction: {
        predicted_shelf_life_days: 0.96,
        predicted_use_by_date: '2026-10-13',
        prediction_interval_90: { min_days: 0.48, max_days: 1.44 },
        storage_guidance: 'Ambient ventilated storage.',
        factors_explanation: 'High ambient temperature accelerates respiration.',
      },
      executionGraph: {},
      agent_states: {},
    };

    (apiClient.post as any).mockImplementation((url: string) => {
      if (url === '/ai/inspect') {
        return Promise.resolve({ data: mockInspectResponse });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<ProduceInspectionWorkspace />);

    const file = new File(['dummy-image-bytes'], 'bell_pepper.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const inspectBtn = screen.getByText(/Run All 8 Agents/i).closest('button')!;
    fireEvent.click(inspectBtn);

    expect(await screen.findByText(/Bell Pepper/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Less than 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Estimated Range:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Physiological Estimate/i)).toBeInTheDocument();
  });

  it('renders whole days with singular/plural for standard shelf-life predictions', async () => {
    const mockInspectResponse = {
      status: 'SUCCESS',
      scan_id: 'scan-wholeday-02',
      workflow_id: 'wf-wholeday-02',
      produce_identification: {
        produce_name: 'Roma Tomato',
        crop_type: 'tomato',
        confidence: 0.96,
      },
      freshness_quality: {
        freshness_score_pct: 90,
        freshness_grade: 'Fresh',
        quality_score: 90,
        firmness_index: 9.0,
        color_uniformity_pct: 96,
      },
      shelf_life_prediction: {
        predicted_shelf_life_days: 4.2,
        predicted_use_by_date: '2026-10-16',
        prediction_interval_90: { min_days: 3.1, max_days: 5.3 },
        storage_guidance: 'Keep in cool ventilated shade.',
        factors_explanation: 'Optimal respiration rate.',
      },
      executionGraph: {},
      agent_states: {},
    };

    (apiClient.post as any).mockImplementation((url: string) => {
      if (url === '/ai/inspect') {
        return Promise.resolve({ data: mockInspectResponse });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<ProduceInspectionWorkspace />);

    const file = new File(['dummy-image-bytes'], 'tomato.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const inspectBtn = screen.getByText(/Run All 8 Agents/i).closest('button')!;
    fireEvent.click(inspectBtn);

    expect(await screen.findByText(/Roma Tomato/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText(/4.2d numeric/i)).toBeInTheDocument();
  });
});
