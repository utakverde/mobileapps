import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export const SQLITE_DATABASE_NAME = 'database.db';
export const SQLITE_DIR = `${FileSystem.documentDirectory ?? ''}SQLite/`;
export const SQLITE_PATH = `${SQLITE_DIR}${SQLITE_DATABASE_NAME}`;
export const ANDROID_PACKAGE_NAME = 'com.powerread.mobile';
export const APP_TRANSFER_BASE_DIR =
  Platform.OS === 'android'
    ? FileSystem.externalFilesDirectory ?? FileSystem.documentDirectory ?? ''
    : FileSystem.documentDirectory ?? '';
export const ADB_DROP_PATH = `${APP_TRANSFER_BASE_DIR}${SQLITE_DATABASE_NAME}`;
export const IMPORT_DIR = `${APP_TRANSFER_BASE_DIR}Import/`;
export const EXPORT_DIR = `${APP_TRANSFER_BASE_DIR}Export/`;
export const IMPORT_FIXED_PATH = `${IMPORT_DIR}${SQLITE_DATABASE_NAME}`;
export const EXPORT_COMPAT_PATH = `${EXPORT_DIR}${SQLITE_DATABASE_NAME}`;
export const BACKUP_DIR = `${EXPORT_DIR}Backup/`;
export const APP_IMAGES_DIR = `${APP_TRANSFER_BASE_DIR}Images/`;
export const IMAGE_DIRS = {
  meter: `${APP_IMAGES_DIR}meter/`,
  house: `${APP_IMAGES_DIR}house/`,
  complaint: `${APP_IMAGES_DIR}complaint/`,
  reading: `${APP_IMAGES_DIR}reading/`,
  disconnection: `${APP_IMAGES_DIR}disconnection/`,
  payment: `${APP_IMAGES_DIR}payment/`,
  profile: `${APP_IMAGES_DIR}profile/`,
};
export const WINDOWS_DOWNLOAD_DATABASE_PATH = 'C:\\FubcsAndroid\\Import\\database.db';
export const WINDOWS_UPLOAD_DATABASE_PATH = 'C:\\FubcsAndroid\\Export\\database.db';
export const WINDOWS_IMAGE_DOWNLOAD_PATH = '\\\\192.168.1.91\\MeterPics\\MAIN OFFICE';
export const WINDOWS_IMPORT_DATABASE_PATH = WINDOWS_DOWNLOAD_DATABASE_PATH;
export const PUBLIC_ANDROID_IMPORT_HINT = '/sdcard/Download/SAMELCO-II/database.db';

export type DatabaseImportPreview = {
  sourceName: string;
  sourceUri: string;
  stagedPath: string;
  tableCount: number;
  compatibleTables: string[];
};

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

function adbPath(uri: string) {
  return uri.replace(/^file:\/\//, '');
}

function isDocumentPickerCancel(result: DocumentPicker.DocumentPickerResult) {
  return result.canceled || !result.assets || result.assets.length === 0;
}

async function validateDatabaseCandidate(sourceUri: string) {
  await ensureAppStorageFolders();
  const tempName = `candidate_${stamp()}_${Date.now()}.db`;
  const tempPath = `${SQLITE_DIR}${tempName}`;

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: tempPath });
    const tempDb = await SQLite.openDatabaseAsync(tempName);
    try {
      const quickCheck = await tempDb.getFirstAsync<Record<string, string>>('PRAGMA quick_check');
      const quickCheckValue = quickCheck ? Object.values(quickCheck)[0] : null;
      if (quickCheckValue && quickCheckValue.toLowerCase() !== 'ok') {
        throw new Error(`SQLite integrity check failed: ${quickCheckValue}`);
      }
      const tables = await tempDb.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      const compatibleTables = tables
        .map((table) => table.name)
        .filter((name) => ['reading', 'billhistory_disco', 'billhistory', 'collectors', 'tblerc'].includes(name.toLowerCase()));

      if (tables.length === 0) {
        throw new Error('The selected SQLite file has no app tables.');
      }

      if (!compatibleTables.some((name) => ['reading', 'billhistory_disco'].includes(name.toLowerCase()))) {
        throw new Error('The selected database does not contain a reading or disconnection assignment table.');
      }

      return {
        tableCount: tables.length,
        compatibleTables,
      };
    } finally {
      await tempDb.closeAsync();
    }
  } finally {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
  }
}

export async function stageDatabaseImport(sourceUri: string, sourceName = SQLITE_DATABASE_NAME): Promise<DatabaseImportPreview> {
  const preview = await validateDatabaseCandidate(sourceUri);
  const stagedPath = IMPORT_FIXED_PATH;
  if (sourceUri !== stagedPath) {
    await FileSystem.deleteAsync(stagedPath, { idempotent: true });
    await FileSystem.copyAsync({ from: sourceUri, to: stagedPath });
  }

  return {
    sourceName,
    sourceUri,
    stagedPath,
    ...preview,
  };
}

export async function pickDatabaseForNextLaunch(): Promise<DatabaseImportPreview | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: [
      'application/vnd.sqlite3',
      'application/x-sqlite3',
      'application/octet-stream',
      '*/*',
    ],
  });

  if (isDocumentPickerCancel(result)) return null;
  const assets = result.assets;
  if (!assets || assets.length === 0) return null;
  const asset = assets[0];
  return stageDatabaseImport(asset.uri, asset.name || SQLITE_DATABASE_NAME);
}

export function getAdbTransferInfo() {
  return {
    packageName: ANDROID_PACKAGE_NAME,
    sqlitePath: adbPath(SQLITE_PATH),
    importDir: adbPath(IMPORT_DIR),
    exportDir: adbPath(EXPORT_DIR),
    exportCompatPath: adbPath(EXPORT_COMPAT_PATH),
    imagesDir: adbPath(APP_IMAGES_DIR),
    windowsImportPath: WINDOWS_IMPORT_DATABASE_PATH,
    windowsDownloadPath: WINDOWS_DOWNLOAD_DATABASE_PATH,
    windowsUploadPath: WINDOWS_UPLOAD_DATABASE_PATH,
    windowsImageDownloadPath: WINDOWS_IMAGE_DOWNLOAD_PATH,
    publicAndroidImportHint: PUBLIC_ANDROID_IMPORT_HINT,
    pullCommand: `adb pull /sdcard/Android/data/${ANDROID_PACKAGE_NAME}/files/Export/${SQLITE_DATABASE_NAME} "${WINDOWS_DOWNLOAD_DATABASE_PATH}"`,
    pushCommand: `adb push "${WINDOWS_UPLOAD_DATABASE_PATH}" /sdcard/Android/data/${ANDROID_PACKAGE_NAME}/files/Import/${SQLITE_DATABASE_NAME}`,
    doctorCommand: '.\\adb-transfer.ps1 -Action Doctor',
    pullExportCommand: `adb pull /sdcard/Android/data/${ANDROID_PACKAGE_NAME}/files/Export C:\\FubcsAndroid\\Import\\Export`,
    pullImagesCommand: `adb pull /sdcard/Android/data/${ANDROID_PACKAGE_NAME}/files/Images/. "${WINDOWS_IMAGE_DOWNLOAD_PATH}"`,
    legacyExternalPullCommand: `adb pull /sdcard/Android/data/${ANDROID_PACKAGE_NAME}/files/Export/${SQLITE_DATABASE_NAME} C:\\FubcsAndroid\\Import\\`,
  };
}

export async function ensureAppStorageFolders() {
  await ensureDir(SQLITE_DIR);
  await ensureDir(IMPORT_DIR);
  await ensureDir(EXPORT_DIR);
  await ensureDir(BACKUP_DIR);
  await ensureDir(APP_IMAGES_DIR);
  await Promise.all(Object.values(IMAGE_DIRS).map((dir) => ensureDir(dir)));
}

export async function backupActiveDatabase(label = 'auto') {
  const info = await FileSystem.getInfoAsync(SQLITE_PATH);
  if (!info.exists) return null;
  const backupDir = `${BACKUP_DIR}${stamp()}/`;
  await ensureDir(backupDir);
  const backupPath = `${backupDir}database_${label}_${stamp()}.db`;
  await FileSystem.copyAsync({ from: SQLITE_PATH, to: backupPath });
  return backupPath;
}

export async function exportDatabaseCopy(label = 'download') {
  const info = await FileSystem.getInfoAsync(SQLITE_PATH);
  if (!info.exists) throw new Error('Active SQLite database was not found.');
  const exportDir = `${EXPORT_DIR}Backup/${stamp()}/`;
  await ensureDir(exportDir);
  const exportPath = `${exportDir}database_${label}_${stamp()}.db`;
  await FileSystem.copyAsync({ from: SQLITE_PATH, to: exportPath });
  return exportPath;
}

export async function exportFixedDatabaseCopy() {
  const info = await FileSystem.getInfoAsync(SQLITE_PATH);
  if (!info.exists) throw new Error('Active SQLite database was not found.');
  await ensureDir(EXPORT_DIR);
  await FileSystem.deleteAsync(EXPORT_COMPAT_PATH, { idempotent: true });
  await FileSystem.copyAsync({ from: SQLITE_PATH, to: EXPORT_COMPAT_PATH });
  return EXPORT_COMPAT_PATH;
}

export async function exportAdbDatabaseCopy() {
  const compatPath = await exportFixedDatabaseCopy();
  const backupPath = await exportDatabaseCopy('downloading');
  return {
    compatPath,
    backupPath,
  };
}

async function listDatabaseCandidates(dir: string, depth = 0): Promise<{ uri: string; modified: number }[]> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists || !info.isDirectory) return [];

  const names = await FileSystem.readDirectoryAsync(dir);
  const candidates: { uri: string; modified: number }[] = [];

  for (const name of names) {
    const uri = `${dir}${name}`;
    const item = await FileSystem.getInfoAsync(uri, { size: true });
    if (item.exists && item.isDirectory && depth < 2) {
      candidates.push(...(await listDatabaseCandidates(`${uri}/`, depth + 1)));
    } else if (item.exists && /\.db$/i.test(name)) {
      candidates.push({
        uri,
        modified: 'modificationTime' in item && item.modificationTime ? item.modificationTime : 0,
      });
    }
  }

  return candidates;
}

async function loadNewestTransferDatabase(options: { includeExport?: boolean } = {}) {
  const directPaths = options.includeExport
    ? [IMPORT_FIXED_PATH, EXPORT_COMPAT_PATH, ADB_DROP_PATH]
    : [IMPORT_FIXED_PATH, ADB_DROP_PATH];
  const directCandidates: { uri: string; modified: number }[] = [];

  for (const uri of directPaths) {
    const item = await FileSystem.getInfoAsync(uri, { size: true });
    if (item.exists && !item.isDirectory && /\.db$/i.test(uri)) {
      directCandidates.push({
        uri,
        modified: 'modificationTime' in item && item.modificationTime ? item.modificationTime : Date.now() / 1000,
      });
    }
  }

  if (directCandidates.length > 0) {
    directCandidates.sort((a, b) => b.modified - a.modified);
    return directCandidates[0];
  }

  const candidates = [
    ...(await listDatabaseCandidates(IMPORT_DIR)),
    ...(options.includeExport ? await listDatabaseCandidates(EXPORT_DIR) : []),
  ];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.modified - a.modified);
  return candidates[0];
}

export async function importNewestDatabaseCopy() {
  await ensureAppStorageFolders();
  const active = await FileSystem.getInfoAsync(SQLITE_PATH, { size: true });
  const imported = await loadNewestTransferDatabase({ includeExport: true });
  if (!imported) return null;
  if (active.exists) await backupActiveDatabase('before_manual_import');
  await FileSystem.copyAsync({ from: imported.uri, to: SQLITE_PATH });
  await FileSystem.deleteAsync(imported.uri, { idempotent: true });
  await backupActiveDatabase('after_manual_import');
  return imported.uri;
}

/** Stage the newest pre-update database so it becomes active after an app restart. */
export async function stageLatestRestorePoint() {
  await ensureAppStorageFolders();
  const candidates = await listDatabaseCandidates(BACKUP_DIR);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.modified - a.modified);
  const restore = candidates[0];
  await backupActiveDatabase('before_restore');
  await FileSystem.deleteAsync(IMPORT_FIXED_PATH, { idempotent: true });
  await FileSystem.copyAsync({ from: restore.uri, to: IMPORT_FIXED_PATH });
  return restore.uri;
}

export async function prepareDatabaseFiles() {
  await ensureAppStorageFolders();

  const active = await FileSystem.getInfoAsync(SQLITE_PATH, { size: true });
  if (active.exists) await backupActiveDatabase('startup');
  return { loadedFromDrop: false };
}
