/**
 * Tiny API client. Keeps the access token in memory, the refresh token in
 * localStorage, and transparently refreshes once on a 401.
 */
import { mockApi } from './mockApi.js';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const REFRESH_KEY = 'p31.refresh';
const DEMO = import.meta.env.VITE_DEMO === 'true';

let accessToken = null;
const listeners = new Set();

export const auth = {
  get accessToken() {
    return accessToken;
  },
  get refreshToken() {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set({ access_token, refresh_token }) {
    accessToken = access_token ?? accessToken;
    try {
      if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn());
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn());
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function raw(path, { method = 'GET', body, authed = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authed && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    throw new ApiError(res.status, e.code || 'UNKNOWN', e.message || 'Request failed', e.details);
  }
  return data;
}

async function tryRefresh() {
  const rt = auth.refreshToken;
  if (!rt) return false;
  try {
    const data = await raw('/auth/refresh', { method: 'POST', body: { refresh_token: rt } });
    auth.set(data);
    return true;
  } catch {
    auth.clear();
    return false;
  }
}

export async function api(path, opts = {}) {
  if (DEMO) {
    try {
      return await mockApi(path, opts);
    } catch (err) {
      throw new ApiError(err.status ?? 500, err.code ?? 'UNKNOWN', err.message);
    }
  }
  try {
    return await raw(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && opts.authed && !opts._retried) {
      if (await tryRefresh()) return api(path, { ...opts, _retried: true });
    }
    throw err;
  }
}
