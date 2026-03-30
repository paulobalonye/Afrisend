import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAccessToken, getRefreshToken, setAccessToken, clearAuthTokens } from '@/lib/auth/cookies';

const DEFAULT_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1')
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/v1');

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: { total?: number; page?: number; limit?: number };
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(baseURL: string = DEFAULT_BASE_URL): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            clearAuthTokens();
            throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
          }

          const response: AxiosResponse<ApiResponse<{ accessToken: string }>> =
            await client.post('/auth/refresh', { refreshToken });

          if (response.data.data?.accessToken) {
            setAccessToken(response.data.data.accessToken);
            return client(originalRequest);
          }
        } catch {
          clearAuthTokens();
          throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
        }
      }

      const statusCode = error.response?.status ?? 0;
      const message = error.response?.data?.error ?? error.message ?? 'Unknown error';
      const code = error.response?.data?.code;
      throw new ApiError(statusCode, message, code);
    },
  );

  return client;
}

export const apiClient = createApiClient();

export async function get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<ApiResponse<T>> = await apiClient.get(path, config);
  if (!response.data.success || response.data.data === null) {
    throw new ApiError(response.status, response.data.error ?? 'Request failed');
  }
  return response.data.data;
}

export async function post<T>(path: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<ApiResponse<T>> = await apiClient.post(path, body, config);
  if (!response.data.success || response.data.data === null) {
    throw new ApiError(response.status, response.data.error ?? 'Request failed');
  }
  return response.data.data;
}

export async function patch<T>(path: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<ApiResponse<T>> = await apiClient.patch(path, body, config);
  if (!response.data.success || response.data.data === null) {
    throw new ApiError(response.status, response.data.error ?? 'Request failed');
  }
  return response.data.data;
}

export async function del<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<ApiResponse<T>> = await apiClient.delete(path, config);
  if (!response.data.success) {
    throw new ApiError(response.status, response.data.error ?? 'Request failed');
  }
  return response.data.data as T;
}
