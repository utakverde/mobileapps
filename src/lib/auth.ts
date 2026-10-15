import { apiJson, isApiConfigured } from './api';

export type LoginMode = 'offline' | 'online';

export type LoginResult =
  | { ok: true; source: LoginMode; displayName?: string; username?: string; collectorId?: number }
  | { ok: false; message: string };

type LoginResponse = {
  success?: boolean;
  ok?: boolean;
  name?: string;
  displayName?: string;
  message?: string;
  username?: string;
  collectorId?: number;
};

const DEV_USERNAME = process.env.EXPO_PUBLIC_DEMO_USERNAME?.trim() || 'test';
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD?.trim() || 'test';

function isDevelopmentDemoLogin(username: string, password: string): boolean {
  return Boolean(__DEV__ && username === DEV_USERNAME && password === DEV_PASSWORD);
}

export async function loginUser(params: {
  username: string;
  password: string;
  mode: LoginMode;
  db?: any;
}): Promise<LoginResult> {
  const username = params.username.trim();
  const password = params.password.trim();

  if (!username || !password) {
    return { ok: false, message: 'Enter your username and password.' };
  }

  if (params.mode === 'online') {
    if (!isApiConfigured()) {
      return { ok: false, message: 'Online login needs EXPO_PUBLIC_API_URL to be configured.' };
    }

    try {
      const result = await apiJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (result.ok === false || result.success === false) {
        return { ok: false, message: result.message || 'Invalid username or password.' };
      }

      return {
          ok: true,
          source: 'online',
          displayName: result.displayName || result.name || username,
          username: result.username || username,
          collectorId: result.collectorId,
        };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not complete online login.',
      };
    }
  }

  if (params.db) {
    try {
      const collector = (await params.db.getFirstAsync(
        `SELECT collector_id, Username, Fullname
         FROM collectors
         WHERE lower(trim(CAST(Username AS TEXT))) = lower(trim(?))
           AND trim(CAST(Password AS TEXT)) = trim(?)
         LIMIT 1`,
        [username, password]
      )) as { collector_id?: number; Fullname?: string; Username?: string } | null;

      if (collector) {
        return {
          ok: true,
          source: 'offline',
          displayName: collector.Fullname || collector.Username || username,
          username: collector.Username || username,
          collectorId: collector.collector_id,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return { ok: false, message: `Collector login table error: ${error.message}` };
      }
    }
  }

  if (isDevelopmentDemoLogin(username, password)) return { ok: true, source: 'offline', displayName: 'Demo Reader', username };

  return { ok: false, message: 'Invalid username or password.' };
}
