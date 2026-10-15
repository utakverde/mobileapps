import type { SyncLog } from '@constants/types';
import { apiJson } from './api';

export type SyncModuleResult = SyncLog & {
  status: 'synced' | 'failed';
  message?: string;
};

export function getLocalSyncQueue(): SyncLog[] {
  return [];
}

export async function runSyncQueue(
  direction: 'sync' | 'upload' | 'download',
  queue: SyncLog[] = getLocalSyncQueue()
): Promise<SyncModuleResult[]> {
  return apiJson<SyncModuleResult[]>('/api/mobile/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      direction,
      modules: queue.map((item) => ({
        module: item.module,
        pendingCount: item.pendingCount,
        failedCount: item.failedCount,
        lastSync: item.lastSync,
      })),
    }),
  });
}
