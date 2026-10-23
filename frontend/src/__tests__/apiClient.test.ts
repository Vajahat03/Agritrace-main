import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../lib/apiClient';
import * as firebaseClient from '../lib/firebaseClient';

vi.mock('../lib/firebaseClient', () => ({
  getCurrentUserIdToken: vi.fn(),
  isFirebaseConfigured: true,
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches Firebase ID token to Authorization header when available', async () => {
    vi.mocked(firebaseClient.getCurrentUserIdToken).mockResolvedValue('test-firebase-id-token');

    // Run interceptor directly
    const requestInterceptor = (apiClient.interceptors.request as any).handlers[0].fulfilled;
    const config: any = { headers: {} };
    const modifiedConfig = await requestInterceptor(config);

    expect(modifiedConfig.headers.Authorization).toBe('Bearer test-firebase-id-token');
  });

  it('formats network failure as explicit backend-disconnected error', async () => {
    const responseInterceptorErr = (apiClient.interceptors.response as any).handlers[0].rejected;
    const networkError = {
      code: 'ERR_NETWORK',
      message: 'Network Error',
      config: { url: '/customer/cart' },
    };

    await expect(responseInterceptorErr(networkError)).rejects.toMatchObject({
      isBackendDisconnected: true,
      code: 'BACKEND_DISCONNECTED',
    });
  });

  it('redacts sensitive mongodb connection strings from error messages', async () => {
    const responseInterceptorErr = (apiClient.interceptors.response as any).handlers[0].rejected;
    const leakError = {
      response: {
        status: 500,
        data: {
          error: {
            message: 'Failed to connect to mongodb+srv://admin:secret123@cluster0.mongodb.net/agritrace',
          },
        },
      },
      config: { url: '/farmer/crops' },
    };

    try {
      await responseInterceptorErr(leakError);
    } catch (err: any) {
      expect(err.message).not.toContain('admin:secret123');
      expect(err.message).toContain('[REDACTED_URI]');
    }
  });

  it('formats request timeout (ECONNABORTED) as REQUEST_TIMEOUT (408)', async () => {
    const responseInterceptorErr = (apiClient.interceptors.response as any).handlers[0].rejected;
    const timeoutError = {
      code: 'ECONNABORTED',
      message: 'timeout of 10000ms exceeded',
      config: { url: '/auth/me' },
    };

    await expect(responseInterceptorErr(timeoutError)).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      statusCode: 408,
    });
  });

  it('avoids retry loop on 401 when already retried', async () => {
    const responseInterceptorErr = (apiClient.interceptors.response as any).handlers[0].rejected;
    const alreadyRetriedError = {
      response: {
        status: 401,
        data: { error: { code: 'UNAUTHORIZED', message: 'Token invalid' } },
      },
      config: { url: '/vendor/inventory', _retry: true },
    };

    await expect(responseInterceptorErr(alreadyRetriedError)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  describe('extractApiArray and extractApiData helpers', () => {
    it('extractApiArray correctly handles nested FastAPI envelope responses', async () => {
      const { extractApiArray } = await import('../lib/apiClient');
      const envelope = {
        data: {
          success: true,
          data: [{ id: 'crop-1', crop_type: 'Tomato' }],
        },
      };
      const result = extractApiArray(envelope);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('crop-1');
    });

    it('extractApiArray handles direct arrays and empty fallbacks', async () => {
      const { extractApiArray } = await import('../lib/apiClient');
      expect(extractApiArray([{ id: '1' }])).toEqual([{ id: '1' }]);
      expect(extractApiArray({ data: [{ id: '2' }] })).toEqual([{ id: '2' }]);
      expect(extractApiArray(null)).toEqual([]);
      expect(extractApiArray({})).toEqual([]);
      expect(extractApiArray({ data: {} })).toEqual([]);
    });

    it('extractApiData correctly unwraps FastAPI envelope object', async () => {
      const { extractApiData } = await import('../lib/apiClient');
      const envelope = {
        data: {
          success: true,
          data: { id: 'farmer-1', name: 'John Doe' },
        },
      };
      const result = extractApiData(envelope, null);
      expect(result).toEqual({ id: 'farmer-1', name: 'John Doe' });
    });
  });
});
