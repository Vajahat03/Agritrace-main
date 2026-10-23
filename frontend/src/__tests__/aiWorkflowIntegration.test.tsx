import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { apiClient } from '../lib/apiClient';
import {
  executeRealAIWorkflow,
  scanRealProduceImage,
  getRealAIWorkflow,
  retryRealAIWorkflow,
} from '../lib/aiClientService';
import { AIAgentsModal } from '../components/AIAgentsModal';

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Phase 5 AI Workflow Frontend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeRealAIWorkflow posts to /ai/agent/run and returns data', async () => {
    const mockResponse = {
      success: true,
      data: {
        workflow_id: 'wf-test-123',
        status: 'COMPLETED',
        executionGraph: {
          perception: { quality_grade: 'Grade A', freshness_score: 92 },
          shelfLife: { estimated_remaining_days: 8.5 },
          decision: { action: 'HOLD_FOR_SPREAD', confidence: 0.95 },
        },
      },
    };
    (apiClient.post as any).mockResolvedValueOnce(mockResponse);

    const result = await executeRealAIWorkflow({
      batchId: 'BATCH-001',
      produceType: 'tomato',
      quantityKg: 200,
      temperatureC: 22,
    });

    expect(apiClient.post).toHaveBeenCalledWith('/ai/agent/run', expect.objectContaining({
      batchId: 'BATCH-001',
      produceType: 'tomato',
      quantityKg: 200,
    }));
    expect(result.workflow_id).toBe('wf-test-123');
  });

  it('scanRealProduceImage sends FormData to /ai/vision/scan', async () => {
    const mockScan = {
      produce_type: 'tomato',
      quality_score: 88,
      freshness_grade: 'fresh',
      status: 'SUCCESS',
    };
    (apiClient.post as any).mockResolvedValueOnce(mockScan);

    const file = new File(['fake-image-bytes'], 'test.jpg', { type: 'image/jpeg' });
    const res = await scanRealProduceImage(file);

    expect(apiClient.post).toHaveBeenCalledWith('/ai/vision/scan', expect.any(FormData));
    expect(res.produce_type).toBe('tomato');
  });

  it('getRealAIWorkflow retrieves workflow from backend', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      id: 'wf-999',
      status: 'COMPLETED',
    });

    const res = await getRealAIWorkflow('wf-999');
    expect(apiClient.get).toHaveBeenCalledWith('/ai/workflows/wf-999');
    expect(res.id).toBe('wf-999');
  });

  it('retryRealAIWorkflow posts to retry endpoint', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      status: 'COMPLETED',
    });

    const res = await retryRealAIWorkflow('wf-fail-01');
    expect(apiClient.post).toHaveBeenCalledWith('/ai/workflows/wf-fail-01/retry');
    expect(res.status).toBe('COMPLETED');
  });

  it('AIAgentsModal executes live DAG and renders execution graph results', async () => {
    const mockDAGOutput = {
      workflow_id: 'wf-live-01',
      status: 'COMPLETED',
      executionGraph: {
        perception: { quality_grade: 'Grade A', freshness_score: 91.0 },
        shelfLife: { estimated_remaining_days: 7.2, spoilage_risk_48h: 0.1 },
        storage: { recommended_temp_c: 13.0, mode: 'SmartBag Active' },
        risk: { thermal_risk: 'LOW', microclimate_stability: 'OPTIMAL' },
        market: { trend: 'RISING', mandi_sentiment: 'Positive' },
        buyerMatching: { topMatch: { buyer_name: 'Metro Direct', offered_price_rs_kg: 32.0 } },
        logistics: { dispatch_window_hours: 36, optimized_route: 'Express Corridor' },
        decision: { action: 'SMARTBAG_DISPATCH', confidence: 0.94, rationale: 'Holding optimal.' },
      },
    };
    (apiClient.post as any).mockResolvedValueOnce(mockDAGOutput);

    render(
      <AIAgentsModal
        isOpen={true}
        onClose={vi.fn()}
        batchId="BATCH-TEST-888"
        produceType="tomato"
        quantityKg={400}
      />
    );

    expect(screen.getByText(/Autonomous 9-Agent DAG Orchestration Engine/i)).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: /Execute Full 9-Agent DAG/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Live Backend 8-Agent DAG Execution/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Grade A/i)).toBeInTheDocument();
    expect(screen.getByText(/Metro Direct/i)).toBeInTheDocument();
    expect(screen.getAllByText(/SMARTBAG_DISPATCH/i).length).toBeGreaterThanOrEqual(1);
  });
});
