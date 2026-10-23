import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ProduceInspectionWorkspace } from '../components/ProduceInspectionWorkspace';
import { apiClient } from '../lib/apiClient';

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('ProduceInspectionWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders produce inspection workspace with upload zone and storage controls', () => {
    render(<ProduceInspectionWorkspace />);

    expect(screen.getByText(/Produce Inspection & Remaining Shelf-Life Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Multimodal Inference/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Storage Facility Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/User-Entered Parameters/i)).toBeInTheDocument();
    expect(screen.getByText(/Run All 8 Agents/i)).toBeInTheDocument();
  });

  it('shows inference results with produce identity, optical quality, and shelf life when API responds', async () => {
    const mockInspectResponse = {
      status: 'SUCCESS',
      scan_id: 'scan-test-12345678',
      workflow_id: 'wf-test-888',
      smartbag_compatible: true,
      produce_identification: {
        produce_name: 'Roma Tomato',
        crop_type: 'tomato',
        confidence: 0.945,
        model_name: 'DenseNet-121 Multi-Head Vision v1.0',
      },
      freshness_quality: {
        freshness_score_pct: 92.0,
        freshness_grade: 'Grade A - Fresh',
        firmness_index: 8.8,
        color_uniformity_pct: 91.0,
        defect_type: 'Minor Calyx Blemish',
        defect_count: 1,
        quality_score: 92.0,
        freshness_recommendation: 'Optimal crisp firmness. Suitable for immediate retail or cold-chain transit.',
      },
      shelf_life_prediction: {
        predicted_shelf_life_days: 5.2,
        predicted_use_by_date: '2026-10-17',
        prediction_interval_90: {
          min_days: 4.1,
          max_days: 6.3,
        },
        storage_guidance: 'Maintain ambient ventilation at 20-22°C with 75% relative humidity.',
        factors_explanation: 'High initial firmness score of 8.8/10 extends remaining edible days.',
        recommended_actions: [
          'Keep stored in ventilated basket away from direct heat sources.',
        ],
      },
      executionGraph: {
        decision: {
          status: 'SUCCESS',
          output: {
            recommendation: 'Retail immediately or preserve in SmartBag cold storage for extended window.',
          },
        },
        risk: {
          status: 'SUCCESS',
          output: {
            risk_category: 'Low',
            summary: 'No active fungal blight detected.',
          },
        },
      },
    };

    (apiClient.post as any).mockImplementation((url: string) => {
      if (url === '/ai/inspect') {
        return Promise.resolve({ data: mockInspectResponse });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<ProduceInspectionWorkspace />);

    // Mock file upload
    const file = new File(['dummy-image-bytes'], 'fresh_tomato.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    const inspectBtn = screen.getByText(/Run All 8 Agents/i).closest('button')!;
    expect(inspectBtn).not.toBeDisabled();

    fireEvent.click(inspectBtn);

    expect(await screen.findByText(/Roma Tomato/i)).toBeInTheDocument();
    expect(screen.getAllByText(/5.2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2026-10-17/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Add Batch to SmartBag Inventory/i)).toBeInTheDocument();
  });

  it('allows adding inspected produce to SmartBag and invokes onBatchAdded', async () => {
    const mockInspectResponse = {
      status: 'SUCCESS',
      scan_id: 'scan-test-12345678',
      workflow_id: 'wf-test-888',
      smartbag_compatible: true,
      produce_identification: {
        produce_name: 'Shimla Apples',
        crop_type: 'apple',
        confidence: 0.96,
        model_name: 'DenseNet-121 Multi-Head Vision v1.0',
      },
      freshness_quality: {
        freshness_score_pct: 88.0,
        freshness_grade: 'Grade A - Fresh',
        firmness_index: 8.5,
        color_uniformity_pct: 89.0,
        defect_type: 'None',
        defect_count: 0,
        quality_score: 88.0,
        freshness_recommendation: 'Crisp fruit tissue. Suitable for cold chamber inventory.',
      },
      shelf_life_prediction: {
        predicted_shelf_life_days: 12.0,
        predicted_use_by_date: '2026-10-24',
        prediction_interval_90: {
          min_days: 10.0,
          max_days: 14.0,
        },
        storage_guidance: 'Store at 4°C in high humidity crisper chamber.',
        factors_explanation: 'Low metabolic respiration under cold storage.',
        recommended_actions: ['Keep segregated from ethylene emitters.'],
      },
      executionGraph: {
        decision: {
          status: 'SUCCESS',
          output: { recommendation: 'Store in refrigerated SmartBag cold chain.' },
        },
      },
    };

    (apiClient.post as any).mockImplementation((url: string) => {
      if (url === '/ai/inspect') {
        return Promise.resolve({ data: mockInspectResponse });
      }
      if (url === '/smartbag/batches') {
        return Promise.resolve({
          data: {
            batch_id: 'SB-TEST-001',
            produce_name: 'Shimla Apples',
            user_id: 'test-user',
            current_status: 'ACTIVE',
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const onBatchAdded = vi.fn();
    render(<ProduceInspectionWorkspace onBatchAdded={onBatchAdded} />);

    // Upload
    const file = new File(['dummy-image-bytes'], 'apple.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Inspect
    fireEvent.click(screen.getByText(/Run All 8 Agents/i));

    // Wait for Add to SmartBag button
    await waitFor(() => {
      expect(screen.getByText(/Add Batch to SmartBag Inventory/i)).toBeInTheDocument();
    });

    // Click Add to SmartBag
    fireEvent.click(screen.getByText(/Add Batch to SmartBag Inventory/i));

    await waitFor(() => {
      expect(onBatchAdded).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Produce added to persistent SmartBag inventory!/i)).toBeInTheDocument();
    });
  });

  it('preserves inspection results and displays clear recoverable error when Add to SmartBag fails due to MongoDB unavailability', async () => {
    const mockInspectResponse = {
      status: 'SUCCESS',
      scan_id: 'scan-test-12345678',
      workflow_id: 'wf-test-888',
      smartbag_compatible: true,
      persisted_durably: false,
      persistence_tier: 'ephemeral_session',
      produce_identification: {
        produce_name: 'Roma Tomato',
        crop_type: 'tomato',
        confidence: 0.95,
        model_name: 'DenseNet-121 Multi-Head Vision v1.0',
      },
      freshness_quality: {
        freshness_score_pct: 90.0,
        freshness_grade: 'Grade A - Fresh',
        firmness_index: 8.5,
        color_uniformity_pct: 90.0,
        defect_type: 'None',
        defect_count: 0,
        quality_score: 90.0,
        freshness_recommendation: 'Optimal crisp firmness.',
      },
      shelf_life_prediction: {
        predicted_shelf_life_days: 5.0,
        predicted_use_by_date: '2026-10-17',
        prediction_interval_90: { min_days: 4.0, max_days: 6.0 },
        storage_guidance: 'Maintain ambient ventilation.',
        factors_explanation: 'High firmness.',
        recommended_actions: ['Keep stored in ventilated basket.'],
      },
      executionGraph: {},
    };

    (apiClient.post as any).mockImplementation((url: string) => {
      if (url === '/ai/inspect') {
        return Promise.resolve({ data: mockInspectResponse });
      }
      if (url === '/smartbag/batches') {
        const err: any = new Error('Database unreachable');
        err.response = {
          status: 503,
          data: {
            message: 'MongoDB Atlas is configured as the authoritative database but is currently unavailable. Operation rejected to prevent unpersisted state.',
          },
        };
        return Promise.reject(err);
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<ProduceInspectionWorkspace />);

    // Upload
    const file = new File(['dummy-image-bytes'], 'tomato.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Inspect
    fireEvent.click(screen.getByText(/Run All 8 Agents/i));

    // Wait for Add to SmartBag button and results to appear
    await waitFor(() => {
      expect(screen.getByText(/Roma Tomato/i)).toBeInTheDocument();
      expect(screen.getByText(/Active Session Multimodal Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/Add Batch to SmartBag Inventory/i)).toBeInTheDocument();
    });

    // Click Add to SmartBag
    fireEvent.click(screen.getByText(/Add Batch to SmartBag Inventory/i));

    // Verify error banner is shown AND analysis results remain completely intact on screen!
    await waitFor(() => {
      expect(screen.getByText(/SmartBag Save Unsuccessful/i)).toBeInTheDocument();
      expect(screen.getByText(/MongoDB Atlas is configured as the authoritative database but is currently unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/Roma Tomato/i)).toBeInTheDocument();
    });
  });
});
