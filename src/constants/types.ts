export type ConsumerStatus = 'unread' | 'read' | 'paid' | 'disconnected' | 'problem';
export type PaymentMethod = 'cash' | 'check' | 'gcash' | 'maya' | 'others';
export type ReadingMode = 'reading' | 'disconnection' | 'net_metering' | 'large_load';
export type ReportType =
  | 'dead_meter'
  | 'rotten_pole'
  | 'leaning_pole'
  | 'illegal_connection'
  | 'wrong_serial'
  | 'low_clearance'
  | 'update_gps'
  | 'not_registered'
  | 'others';
export type SyncStatus = 'pending' | 'synced' | 'failed';
export type PrintSetting = 'always_ask' | 'auto_print' | 'no_printing';
export type SortOrder = 'sequence' | 'account_number' | 'account_name';
export type PrinterType = 'woosim' | 'generic_escpos' | 'other';

export interface Consumer {
  id: string;
  accountNumber: string;
  name: string;
  address: string;
  mobileNumber?: string;
  serialNumber: string;
  sequenceNumber: number;
  meterNumber: string;
  rateCode: string;
  poleNumber: string;
  transformer: string;
  previousReading: number;
  currentReading: number | null;
  multiplier: number;
  kwhUsed: number | null;
  billAmount: number;
  penalty: number;
  totalDue: number;
  dueDate: string;
  disconnectionDate: string;
  status: ConsumerStatus;
  gpsLat: number | null;
  gpsLng: number | null;
  remarks: string;
  bookNumber: string;
  areaCode: string;
  billMonth: string;
  meterPhoto: string | null;
  housePhoto: string | null;
}

export interface Payment {
  id: string;
  orNumber: string;
  accountNumber: string;
  consumerName: string;
  billMonth: string;
  billAmount: number;
  penalty: number;
  totalDue: number;
  amountPaid: number;
  change: number;
  paymentDate: string;
  collectorName: string;
  paymentMethod: PaymentMethod;
  isSynced: boolean;
}

export interface ReadingArea {
  areaCode: string;
  areaName: string;
  bookNumber: string;
  billMonth: string;
  readerName: string;
  prevReadingDate: string;
  presentReadingDate: string;
  dueDate: string;
  disconnectionDate: string;
}

export interface AppSettings {
  printSetting: PrintSetting;
  recordView: 'all' | 'unread' | 'paid';
  sortOrder: SortOrder;
  printerType: PrinterType;
  showReportsButton: boolean;
  showPayButton: boolean;
  showPrintButton: boolean;
  autoNextRecord: boolean;
  enableGPS: boolean;
  enableCamera: boolean;
  enableAutoSync: boolean;
  enableOfflineMode: boolean;
  enableOnlineMode: boolean;
  serverUrl: string;
  lastSyncDate: string | null;
  bluetoothPrinterName: string | null;
  isDeveloperMode: boolean;
}

export interface SyncLog {
  module: string;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSync: string | null;
}

export interface ComplaintReport {
  id: string;
  accountNumber: string;
  consumerName: string;
  address: string;
  reportType: ReportType;
  remarks: string;
  priority: 'low' | 'normal' | 'high';
  gpsLat: number | null;
  gpsLng: number | null;
  photoUri: string | null;
  status: SyncStatus;
  createdAt: string;
}

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  isPaired: boolean;
  isConnected: boolean;
  rssi?: number;
}
