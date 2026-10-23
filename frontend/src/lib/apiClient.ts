import axios, { AxiosError } from 'axios';
import { getCurrentUserIdToken } from './firebaseClient';

/**
 * AgriTrace API Client
 * Uses environment variable NEXT_PUBLIC_API_URL or defaults to local backend.
 * Stale Render deployment fallbacks and hardcoded credentials have been removed.
 */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

export interface AgriTraceApiError extends Error {
  isBackendDisconnected?: boolean;
  statusCode?: number;
  code?: string;
  endpoint?: string;
  response?: AxiosError['response'];
  data?: any;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor: Attach fresh Firebase ID token
apiClient.interceptors.request.use(async (config) => {
  try {
    const forceRefresh = Boolean((config as any)?._forceRefresh);
    const idToken = await getCurrentUserIdToken(forceRefresh);
    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (err) {
    console.warn('[AgriTrace API Client] Failed to obtain Firebase ID token:', err);
  }

  return config;
});

// Response Interceptor: Explicit error handling with token refresh retry and backend-disconnected detection
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error?.config as any;

    // Retry once with a force-refreshed token on 401 Unauthorized (unless already retried)
    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshedToken = await getCurrentUserIdToken(true);
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        console.warn('[AgriTrace API Client] Token refresh retry failed:', refreshErr);
      }
    }

    const formattedError: AgriTraceApiError = new Error();
    formattedError.endpoint = error?.config?.url;
    formattedError.response = error?.response;
    formattedError.data = error?.response?.data;

    // Distinguish request timeout from connection refused / disconnected
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    if (isTimeout) {
      formattedError.message = `Request timed out: Server at ${API_BASE_URL} took too long to respond. Please check your connection or retry.`;
      formattedError.code = 'REQUEST_TIMEOUT';
      formattedError.statusCode = 408;
      return Promise.reject(formattedError);
    }

    const isNetworkError =
      !error?.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('Failed to fetch');

    if (isNetworkError) {
      formattedError.message = `Backend disconnected: Unable to connect to API server at ${API_BASE_URL}. Ensure the backend service is running.`;
      formattedError.isBackendDisconnected = true;
      formattedError.code = 'BACKEND_DISCONNECTED';
      formattedError.statusCode = 503;
      return Promise.reject(formattedError);
    }

    formattedError.statusCode = error.response?.status;
    formattedError.code = error.response?.data?.error?.code || error.code || 'API_ERROR';

    // Safely extract message without leaking stack traces or credentials
    const serverMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Request failed with server error';

    // Filter out potential internal leaks (e.g., MongoDB connection strings or tokens)
    const sanitizedMessage = String(serverMessage).replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]');
    formattedError.message = sanitizedMessage;

    return Promise.reject(formattedError);
  }
);

/**
 * Safely extracts an array from AgriTrace API responses.
 * Handles both direct arrays and FastAPI envelopes ({ success: true, data: [...] }).
 */
export function extractApiArray<T = any>(res: any): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.data) {
    if (Array.isArray(res.data)) return res.data;
    if (res.data.data && Array.isArray(res.data.data)) return res.data.data;
  }
  return [];
}

/**
 * Safely extracts an object or scalar data from AgriTrace API responses.
 * Handles both direct data and FastAPI envelopes ({ success: true, data: {...} }).
 */
export function extractApiData<T = any>(res: any, fallback: T): T {
  if (!res) return fallback;
  if (res.data !== undefined) {
    if (res.data?.data !== undefined) return res.data.data;
    return res.data;
  }
  return res ?? fallback;
}

