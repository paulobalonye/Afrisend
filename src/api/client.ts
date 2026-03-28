import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getAccessToken, getRefreshToken, saveAccessToken, clearAuthTokens } from '@/utils/storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.afrisend.com/v1';
const TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 30000);

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
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

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Attach auth token to every request
  client.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) {
      return {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      };
    }
    return config;
  });

  // Handle 401 with token refresh
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            await clearAuthTokens();
            throw new ApiError(401, 'Session expired', 'SESSION_EXPIRED');
          }

          const response: AxiosResponse<ApiResponse<{ accessToken: string }>> =
            await client.post('/auth/refresh', { refreshToken });

          if (response.data.data?.accessToken) {
            await saveAccessToken(response.data.data.accessToken);
            return client(originalRequest);
          }
        } catch {
          await clearAuthTokens();
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

export async function uploadFile<T>(
  path: string,
  fileUri: string,
  fieldName: string,
  mimeType: string,
  extraFields?: Record<string, string>,
): Promise<T> {
  const formData = new FormData();

  const fileName = fileUri.split('/').pop() ?? 'file.jpg';
  formData.append(fieldName, {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  const response: AxiosResponse<ApiResponse<T>> = await apiClient.post(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data.success || response.data.data === null) {
    throw new ApiError(response.status, response.data.error ?? 'Upload failed');
  }
  return response.data.data;
}
