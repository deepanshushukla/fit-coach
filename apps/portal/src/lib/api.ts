const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'formcoach.accessToken';
const REFRESH_TOKEN_KEY = 'formcoach.refreshToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function rawRequest(path: string, init: RequestInit, accessToken: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const body = await res.json();
  setTokens(body.accessToken, body.refreshToken);
  return true;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, init, getAccessToken());

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, init, getAccessToken());
    }
  }

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // response had no JSON body
    }
    if (res.status === 401) clearTokens();
    throw new ApiRequestError(code, message, res.status);
  }

  if (res.status === 204 || res.status === 202) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
