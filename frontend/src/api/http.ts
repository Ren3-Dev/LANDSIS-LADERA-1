export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const response = await fetch(`/api/v1/${path}`, { ...options, signal, credentials: 'same-origin', headers: {
    ...(options.method && options.method !== 'GET' ? { 'Content-Type': 'application/json', 'X-Landsis-Request': '1' } : {}), ...options.headers,
  } });
  if (response.status === 401 && path !== 'auth/login' && path !== 'auth/me') window.dispatchEvent(new Event('landsis-session-expired'));
  return response;
}
export async function jsonRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await apiRequest(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof data.message === 'string' ? data.message : 'No se pudo completar la solicitud.');
  }
  return response.status === 204 ? undefined as T : response.json();
}
