const CONFIG_TABLE = 'config';

const KEY_COLUMNS = ['key', 'config_key', 'name', 'setting', 'setting_key'];
const VALUE_COLUMNS = ['value', 'config_value', 'setting_value', 'data'];

const OR_COLUMNS = ['app_or_number', 'or_number', 'ornumber', 'ORNumber', 'official_receipt_no', 'last_or_number'];
const REMEMBER_LOGIN_COLUMNS = ['app_remember_login', 'remember_login', 'remember_user', 'rememberUser'];
const LOGIN_USERNAME_COLUMNS = ['app_login_username', 'login_username', 'saved_username', 'savedUserName'];
const LOGIN_PASSWORD_COLUMNS = ['app_login_password', 'login_password', 'saved_password', 'savedPassword'];
const PRINTER_NAME_COLUMNS = ['app_printer_name', 'printer_name', 'bluetooth_printer_name', 'bluetoothPrinterName', 'bt_name', 'PrinterName'];
const PRINTER_ADDRESS_COLUMNS = [
  'app_printer_address',
  'printer_address',
  'bluetooth_printer_address',
  'bluetoothPrinterAddress',
  'bt_address',
  'mac_address',
  'MACAddress',
  'mac',
];
const PRINTER_ID_COLUMNS = ['app_printer_id', 'printer_id', 'bluetooth_printer_id', 'bluetoothPrinterId', 'bt_id'];
const PRINTER_TYPE_COLUMNS = ['app_printer_type', 'printer_type', 'printerType', 'PrinterType'];
const PRINTER_CONNECTED_COLUMNS = ['app_printer_connected', 'printer_connected', 'is_connected', 'isConnected', 'connected'];
const SETUP_TABLE = 'setup';

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function tableExists(db, tableName) {
  const row = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1", [
    tableName,
  ]);
  return Boolean(row);
}

async function ensureConfigTable(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${q(CONFIG_TABLE)} (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT,
      updated_at TEXT
    );
  `);
}

async function tableColumns(db) {
  await ensureConfigTable(db);
  const rows = await db.getAllAsync(`PRAGMA table_info(${q(CONFIG_TABLE)})`);
  return rows.map((row) => row.name);
}

function firstExisting(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

function firstValue(row, candidates, fallback = '') {
  for (const column of candidates) {
    if (row?.[column] != null && row[column] !== '') return row[column];
  }
  const lowerMap = Object.keys(row || {}).reduce((map, key) => {
    map[String(key).toLowerCase()] = key;
    return map;
  }, {});
  for (const column of candidates) {
    const key = lowerMap[String(column).toLowerCase()];
    if (key && row?.[key] != null && row[key] !== '') return row[key];
  }
  return fallback;
}

async function getSingleConfigRow(db) {
  if (!(await tableExists(db, CONFIG_TABLE))) return null;
  return db.getFirstAsync(`SELECT rowid AS _rowid, * FROM ${q(CONFIG_TABLE)} ORDER BY rowid LIMIT 1`);
}

async function ensureSingleRowColumn(db, columns, candidates, fallbackColumn) {
  const existing = firstExisting(columns, candidates);
  if (existing) return existing;
  await db.execAsync(`ALTER TABLE ${q(CONFIG_TABLE)} ADD COLUMN ${q(fallbackColumn)} TEXT`);
  columns.push(fallbackColumn);
  return fallbackColumn;
}

async function getConfigValue(db, key, singleRowColumns = []) {
  const columns = await tableColumns(db);
  const keyColumn = firstExisting(columns, KEY_COLUMNS);
  const valueColumn = firstExisting(columns, VALUE_COLUMNS);

  if (keyColumn && valueColumn) {
    const row = await db.getFirstAsync(
      `SELECT ${q(valueColumn)} AS value FROM ${q(CONFIG_TABLE)} WHERE ${q(keyColumn)} = ? LIMIT 1`,
      [key]
    );
    if (row?.value != null) return String(row.value);
  }

  const row = await getSingleConfigRow(db);
  const value = firstValue(row, singleRowColumns, null);
  return value == null ? '' : String(value);
}

async function setConfigValue(db, key, value, singleRowColumns = [], fallbackColumn = key) {
  const columns = await tableColumns(db);
  const ts = new Date().toISOString();
  const keyColumn = firstExisting(columns, KEY_COLUMNS);
  const valueColumn = firstExisting(columns, VALUE_COLUMNS);
  const updatedColumn = firstExisting(columns, ['updated_at', 'UpdatedAt', 'date_updated']);

  if (keyColumn && valueColumn) {
    const existing = await db.getFirstAsync(
      `SELECT rowid FROM ${q(CONFIG_TABLE)} WHERE ${q(keyColumn)} = ? LIMIT 1`,
      [key]
    );
    if (existing) {
      const assignments = [`${q(valueColumn)} = ?`];
      const params = [String(value)];
      if (updatedColumn) {
        assignments.push(`${q(updatedColumn)} = ?`);
        params.push(ts);
      }
      params.push(key);
      await db.runAsync(`UPDATE ${q(CONFIG_TABLE)} SET ${assignments.join(', ')} WHERE ${q(keyColumn)} = ?`, params);
      return;
    }

    const insertColumns = [keyColumn, valueColumn];
    const params = [key, String(value)];
    if (updatedColumn) {
      insertColumns.push(updatedColumn);
      params.push(ts);
    }
    await db.runAsync(
      `INSERT INTO ${q(CONFIG_TABLE)} (${insertColumns.map(q).join(', ')}) VALUES (${insertColumns.map(() => '?').join(', ')})`,
      params
    );
    return;
  }

  const targetColumn = await ensureSingleRowColumn(db, columns, singleRowColumns, fallbackColumn);
  let row = await getSingleConfigRow(db);
  if (!row) {
    await db.runAsync(`INSERT INTO ${q(CONFIG_TABLE)} DEFAULT VALUES`);
    row = await getSingleConfigRow(db);
  }
  await db.runAsync(`UPDATE ${q(CONFIG_TABLE)} SET ${q(targetColumn)} = ? WHERE rowid = ?`, [String(value), row._rowid]);
}

async function saveLoginOrNumber(db, orNumber) {
  return setConfigValue(db, 'login_or_number', orNumber, OR_COLUMNS, 'app_or_number');
}

async function getLoginOrNumber(db) {
  return getConfigValue(db, 'login_or_number', OR_COLUMNS);
}

async function saveRememberedLogin(db, input = {}) {
  if (input.remember != null) {
    await setConfigValue(
      db,
      'app_remember_login',
      input.remember ? '1' : '0',
      REMEMBER_LOGIN_COLUMNS,
      'app_remember_login'
    );
  }

  if (input.username != null) {
    await setConfigValue(db, 'app_login_username', input.username, LOGIN_USERNAME_COLUMNS, 'app_login_username');
  }

  if (input.password != null) {
    await setConfigValue(db, 'app_login_password', input.password, LOGIN_PASSWORD_COLUMNS, 'app_login_password');
  }
}

async function getRememberedLogin(db) {
  const remember = String(await getConfigValue(db, 'app_remember_login', REMEMBER_LOGIN_COLUMNS)).trim().toLowerCase();
  return {
    remember: remember === '1' || remember === 'true' || remember === 'yes' || remember === 'y',
    username: await getConfigValue(db, 'app_login_username', LOGIN_USERNAME_COLUMNS),
    password: await getConfigValue(db, 'app_login_password', LOGIN_PASSWORD_COLUMNS),
  };
}

async function clearRememberedLogin(db) {
  await saveRememberedLogin(db, { remember: false, username: '', password: '' });
}

function normalizePrinterType(type = '') {
  const value = String(type || '').trim().toLowerCase();
  if (value === 'generic' || value === 'generic_escpos' || value === 'escpos') return 'generic_escpos';
  if (value === 'woosim') return 'woosim';
  return value || 'woosim';
}

function asConnected(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'y' || text === 'yes' || text === 'connected';
}

async function getBluetoothPrinterConfig(db) {
  const row = await getSingleConfigRow(db);
  const columns = await tableColumns(db);
  const keyColumn = firstExisting(columns, KEY_COLUMNS);
  const valueColumn = firstExisting(columns, VALUE_COLUMNS);

  const fromRows = async (keys) => {
    if (!keyColumn || !valueColumn) return '';
    for (const key of keys) {
      const value = await getConfigValue(db, key);
      if (value) return value;
    }
    return '';
  };

  const id = firstValue(row, PRINTER_ID_COLUMNS) || (await fromRows(['bluetooth_printer_id', 'printer_id']));
  const name = firstValue(row, PRINTER_NAME_COLUMNS) || (await fromRows(['bluetooth_printer_name', 'printer_name']));
  const address =
    firstValue(row, PRINTER_ADDRESS_COLUMNS) || (await fromRows(['bluetooth_printer_address', 'printer_address', 'mac_address']));
  const printerType = normalizePrinterType(
    firstValue(row, PRINTER_TYPE_COLUMNS) || (await fromRows(['printer_type', 'bluetooth_printer_type']))
  );
  const connected = asConnected(firstValue(row, PRINTER_CONNECTED_COLUMNS) || (await fromRows(['printer_connected'])));

  return {
    id: String(id || address || name || ''),
    name: String(name || ''),
    address: String(address || ''),
    printerType,
    isConnected: Boolean(connected || name || address || id),
  };
}

async function saveBluetoothPrinterConfig(db, input = {}) {
  if (input.id != null) await setConfigValue(db, 'bluetooth_printer_id', input.id, PRINTER_ID_COLUMNS, 'app_printer_id');
  if (input.name != null) await setConfigValue(db, 'bluetooth_printer_name', input.name, PRINTER_NAME_COLUMNS, 'app_printer_name');
  if (input.address != null) {
    await setConfigValue(db, 'bluetooth_printer_address', input.address, PRINTER_ADDRESS_COLUMNS, 'app_printer_address');
  }
  if (input.printerType != null) {
    await setConfigValue(db, 'printer_type', normalizePrinterType(input.printerType), PRINTER_TYPE_COLUMNS, 'app_printer_type');
  }
  if (input.isConnected != null) {
    await setConfigValue(
      db,
      'printer_connected',
      input.isConnected ? '1' : '0',
      PRINTER_CONNECTED_COLUMNS,
      'app_printer_connected'
    );
  }
}

async function getInvoicePrintSetup(db) {
  if (!(await tableExists(db, SETUP_TABLE))) {
    return {
      accn: '',
      permitNo: '',
      rangeStart: '',
      rangeEnd: '',
      latBillNo: '',
      dateIssued: 'November 15,2024',
      dateUsage: 'November 15,2024',
    };
  }

  const rows = await db.getAllAsync(`SELECT * FROM ${q(SETUP_TABLE)} ORDER BY rowid`);
  const row = rows[0] || {};
  const latBillNoRow = rows.find((item) => firstValue(item, ['LATBILLNO', 'LatBillNo', 'latbillno'])) || row;
  const latBillNo = firstValue(latBillNoRow, ['LATBILLNO', 'LatBillNo', 'latbillno']);
  const dateIssued = firstValue(row, ['date_usage', 'DateIssued', 'date_issued'], 'November 15,2024');

  return {
    accn: firstValue(row, ['AccredititionNo', 'AccreditationNo', 'ACCN', 'accn']),
    permitNo: firstValue(row, ['PermitNo', 'permit_no']),
    rangeStart: '',
    rangeEnd: latBillNo,
    lastBillNoStart: '',
    lastBillNo: latBillNo,
    latBillNo,
    dateIssued,
    dateUsage: dateIssued,
    tin: firstValue(row, ['TIN', 'tin']),
    address: firstValue(row, ['Address', 'address']),
    telNo: firstValue(row, ['TelNo', 'tel_no']),
  };
}

module.exports = {
  getBluetoothPrinterConfig,
  getConfigValue,
  getInvoicePrintSetup,
  getLoginOrNumber,
  getRememberedLogin,
  saveBluetoothPrinterConfig,
  saveLoginOrNumber,
  saveRememberedLogin,
  clearRememberedLogin,
  setConfigValue,
};
