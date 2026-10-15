import Constants from 'expo-constants';

/**
 * Base URL for your Cloudflare Worker (`otto-api`), without trailing slash.
 * Set in project root `.env`:
 *   EXPO_PUBLIC_API_URL=https://otto-api.your-subdomain.workers.dev
 *
 * After changing `.env`, restart Metro (`npx expo start -c`).
 */
export function getApiBaseUrl(): string {
  const fromEnv = typeof process.env.EXPO_PUBLIC_API_URL === 'string' ? process.env.EXPO_PUBLIC_API_URL.trim() : '';
  const fromExtra =
    typeof Constants.expoConfig?.extra?.apiUrl === 'string'
      ? (Constants.expoConfig.extra.apiUrl as string).trim()
      : '';
  return (fromEnv || fromExtra).replace(/\/+$/, '');
}

function getApiKey(): string {
  const fromEnv = typeof process.env.EXPO_PUBLIC_API_KEY === 'string' ? process.env.EXPO_PUBLIC_API_KEY.trim() : '';
  const fromExtra =
    typeof Constants.expoConfig?.extra?.apiKey === 'string'
      ? (Constants.expoConfig.extra.apiKey as string).trim()
      : '';
  return fromEnv || fromExtra;
}

function getInternalApiSecret(): string {
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_INTERNAL_API_SECRET === 'string'
      ? process.env.EXPO_PUBLIC_INTERNAL_API_SECRET.trim()
      : '';
  const fromExtra =
    typeof Constants.expoConfig?.extra?.internalApiSecret === 'string'
      ? (Constants.expoConfig.extra.internalApiSecret as string).trim()
      : '';
  return fromEnv || fromExtra;
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}

function configuredApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  const internalSecret = getInternalApiSecret();

  if (apiKey) headers['x-api-key'] = apiKey;
  if (internalSecret) headers['x-internal-secret'] = internalSecret;

  return headers;
}

const DEFAULT_TIMEOUT_MS = 15000;

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Add it to .env and restart Expo.');
  }
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${p}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...configuredApiHeaders(),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s: ${p}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message?: unknown }).message)
        : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

/** Quick check — expects Worker `/health` or `/api/health` (see otto-api). */
export async function pingApiHealth(): Promise<{ ok: boolean; body?: string }> {
  const base = getApiBaseUrl();
  if (!base) return { ok: false, body: 'not_configured' };
  for (const path of ['/health', '/api/health', '/']) {
    try {
      const res = await fetch(`${base}${path === '/' ? '' : path}`, {
        method: 'GET',
        headers: { Accept: '*/*', ...configuredApiHeaders() },
      });
      const text = await res.text();
      if (res.ok) return { ok: true, body: text.slice(0, 200) };
    } catch {
      // try next path
    }
  }
  return { ok: false, body: 'unreachable' };
}
