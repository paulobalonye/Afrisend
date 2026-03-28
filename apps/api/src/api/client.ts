// Stub API client for apps/api — used only in tests where calls are mocked.
// The actual HTTP client lives in apps/mobile/src/api/client.ts.

export async function post<T>(_path: string, _data?: unknown): Promise<T> {
  throw new Error('API client should be mocked in tests');
}

export async function get<T>(_path: string): Promise<T> {
  throw new Error('API client should be mocked in tests');
}

export async function uploadFile<T>(
  _path: string,
  _fileUri: string,
  _fieldName: string,
  _mimeType: string,
  _extraFields?: Record<string, string>,
): Promise<T> {
  throw new Error('API client should be mocked in tests');
}
