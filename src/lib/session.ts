import type { ReadingMode } from '@constants/types';

let activeReadingMode: ReadingMode = 'reading';
let activeCollectorName = '';
let activeUsername = '';
let activeOrNumber = '';
let activeCollectorId: number | null = null;

export function setActiveReadingMode(mode: ReadingMode) {
  activeReadingMode = mode;
}

export function getActiveReadingMode(): ReadingMode {
  return activeReadingMode;
}

export function setActiveSession(params: {
  readingMode: ReadingMode;
  collectorName?: string;
  collectorId?: number;
  username?: string;
  orNumber: string;
}) {
  activeReadingMode = params.readingMode;
  activeCollectorName = params.collectorName?.trim() || params.username?.trim() || 'Field Reader';
  activeUsername = params.username?.trim() || '';
  activeOrNumber = params.orNumber.trim();
  activeCollectorId = params.collectorId ?? null;
}

export function getActiveCollectorName(): string {
  return activeCollectorName;
}

export function getActiveUsername(): string {
  return activeUsername;
}

export function getActiveOrNumber(): string {
  return activeOrNumber;
}

export function getActiveCollectorId(): number | null {
  return activeCollectorId;
}

export function getModeLabel(mode: ReadingMode = activeReadingMode): string {
  switch (mode) {
    case 'disconnection':
      return 'Disconnection';
    case 'net_metering':
      return 'Net Metering';
    case 'large_load':
      return 'Large Load Reading';
    default:
      return 'Reading';
  }
}
