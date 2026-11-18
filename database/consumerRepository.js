const { getReadingRecord, listReadingRecords } = require('./invoiceRepository');

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function tableExists(db, tableName) {
  const row = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1", [
    tableName,
  ]);
  return Boolean(row);
}

async function tableColumns(db, tableName) {
  if (!(await tableExists(db, tableName))) return [];
  const rows = await db.getAllAsync(`PRAGMA table_info(${q(tableName)})`);
  return rows.map((row) => row.name);
}

async function ensureColumn(db, tableName, name, type) {
  const columns = await tableColumns(db, tableName);
  if (!columns.includes(name)) {
    await db.execAsync(`ALTER TABLE ${q(tableName)} ADD COLUMN ${q(name)} ${type}`);
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstValue(record, fields, fallback = '') {
  for (const field of fields) {
    if (record?.[field] != null && record[field] !== '') return record[field];
  }
  return fallback;
}

function parseGps(record) {
  const lat = firstValue(record, ['gps_lat', 'app_gps_lat', 'Latitude', 'lat', 'mLat'], null);
  const lng = firstValue(record, ['gps_lng', 'app_gps_lng', 'Longitude', 'lng', 'mLng'], null);
  if (lat != null && lng != null) {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) return { lat: parsedLat, lng: parsedLng };
  }

  const combined = String(firstValue(record, ['mLongLat', 'MLatLong', 'HLatLong', 'LongLat', 'GPS', 'gps'], '')).trim();
  const match = combined.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return { lat: null, lng: null };
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function hasSavedReading(record) {
  return Boolean(
    record &&
      (record.flag_read === 1 ||
        record.flag_read === '1' ||
        record.present_reading != null ||
        record.computed_kwh != null ||
        record.PresentReadingKWH != null ||
        record.KilowattHour != null ||
        record.KilowattUsed != null)
  );
}

async function getBillHistoryForRecord(db, record) {
  if (!record || !(await tableExists(db, 'billhistory'))) return null;
  const columns = await tableColumns(db, 'billhistory');
  const code = firstValue(record, ['code', 'Code'], null);
  const account = String(firstValue(record, ['AccountNumber', 'accountnumber'], ''));
  const billMonth = String(firstValue(record, ['BillMonth', 'billmonth'], ''));

  if (code != null && columns.includes('Code')) {
    const byCode = await db.getFirstAsync(
      `SELECT rowid AS _rowid, * FROM billhistory WHERE Code = ? AND BillMonth = ? LIMIT 1`,
      [String(code), billMonth]
    );
    if (byCode) return byCode;
  }

  return db.getFirstAsync(
    `SELECT rowid AS _rowid, * FROM billhistory WHERE AccountNumber = ? AND BillMonth = ? LIMIT 1`,
    [account, billMonth]
  );
}

async function getPaymentForRecord(db, record, options = {}) {
  const payTable = options.mode === 'disconnection' ? 'billhistory_disco_pay' : 'reading_pay';
  if (!record || !(await tableExists(db, payTable))) return null;
  const columns = await tableColumns(db, payTable);
  const code = firstValue(record, ['code', 'Code'], null);
  const account = String(firstValue(record, ['AccountNumber', 'accountnumber'], ''));
  const billMonth = String(firstValue(record, ['BillMonth', 'billmonth'], ''));

  if (code != null && columns.includes('Code')) {
    const byCode = await db.getFirstAsync(
      `SELECT * FROM ${q(payTable)} WHERE Code = ? AND BillMonth = ? ORDER BY date_paid DESC LIMIT 1`,
      [String(code), billMonth]
    );
    if (byCode) return byCode;
  }

  return db.getFirstAsync(
    `SELECT * FROM ${q(payTable)} WHERE AccountNumber = ? AND BillMonth = ? ORDER BY date_paid DESC LIMIT 1`,
    [account, billMonth]
  );
}

function statusFor(record) {
  const connStatus = String(firstValue(record, ['ConnStatus', 'StatusCode'], '')).toLowerCase();
  const remarks = String(firstValue(record, ['remarks', 'Remarks', 'FeedBackCode'], '')).toLowerCase();
  const invoiceStatus = String(firstValue(record, ['invoice_status'], '')).toLowerCase();
  if (
    record.flag_paid === 1 ||
    record.flag_paid === '1' ||
    record.flag_paid === 'Y' ||
    record._payment_exists === true
  ) return 'paid';
  if (firstValue(record, ['app_disconnected_at', 'date_disconnected', 'disconnected_at'], '')) return 'disconnected';
  if (connStatus.includes('disconnect') || connStatus === 'd') return 'disconnected';
  if (remarks.includes('problem') || remarks.includes('tamper') || remarks.includes('not found')) return 'problem';
  if (
    record.flag_read === 1 ||
    record.flag_read === '1' ||
    record.present_reading != null ||
    record.PresentReadingKWH != null ||
    record.computed_kwh != null ||
    record.KilowattHour != null ||
    record.KilowattUsed != null ||
    record._bill_history_exists === true ||
    (invoiceStatus && invoiceStatus !== 'pending')
  ) {
    return 'read';
  }
  return 'unread';
}

function mergeStatusRecord(record, historyRow, paymentRow) {
  if (!historyRow && !paymentRow) return record;
  return {
    ...record,
    ...(historyRow || {}),
    _bill_history_exists: Boolean(historyRow),
    _payment_exists: Boolean(paymentRow),
    AccountNumber: firstValue(historyRow, ['AccountNumber'], record.AccountNumber),
    BillMonth: firstValue(historyRow, ['BillMonth'], record.BillMonth),
    code: firstValue(record, ['code'], historyRow?.Code),
    Code: firstValue(record, ['Code'], historyRow?.Code),
    flag_paid: paymentRow ? 'Y' : firstValue(historyRow, ['flag_paid'], record.flag_paid),
    present_reading: firstValue(record, ['present_reading'], historyRow?.PresentReadingKWH),
    computed_kwh: firstValue(record, ['computed_kwh'], historyRow?.KilowattHour || historyRow?.KilowattUsed),
    total_bill: firstValue(record, ['total_bill'], historyRow?.TotalBill),
  };
}

async function mapReadingToConsumerWithStatus(db, record, options = {}) {
  if (options.mode === 'disconnection') return mapReadingToConsumer(record);
  const [historyRow, paymentRow] = await Promise.all([
    getBillHistoryForRecord(db, record),
    getPaymentForRecord(db, record, options),
  ]);
  return mapReadingToConsumer(mergeStatusRecord(record, historyRow, paymentRow));
}

function mapReadingToConsumer(record) {
  const gps = parseGps(record);
  const id = String(firstValue(record, ['code', 'Code', '_rowid', 'AccountNumber'], ''));
  const previousReading = toNumber(firstValue(record, ['Reading_KWH_Prev', 'PreviousReadingKWH', 'previous_reading'], 0));
  const presentReadingRaw = firstValue(record, ['present_reading', 'Reading_KWH', 'PresentReadingKWH'], null);
  const totalBill = toNumber(firstValue(record, ['total_bill', 'TotalBill', 'balance_previous'], 0));
  const arrears = toNumber(firstValue(record, ['balance_previous'], 0));
  const currentBill = totalBill || 0;

  return {
    id,
    accountNumber: String(firstValue(record, ['AccountNumber', 'accountnumber'], '')),
    name: String(firstValue(record, ['Name', 'Fullname', 'ConsumerName'], '')),
    address: String(firstValue(record, ['Address'], '')),
    mobileNumber: String(firstValue(record, ['MobileNumber', 'Mobile', 'ContactNumber', 'Phone', 'TelNo'], '')),
    serialNumber: String(firstValue(record, ['Serial', 'MeterNumber'], '')),
    sequenceNumber: toNumber(firstValue(record, ['Sequence'], 0)),
    meterNumber: String(firstValue(record, ['Serial', 'MeterNumber'], '')),
    rateCode: String(firstValue(record, ['RateCode', 'CTYPE'], '')),
    poleNumber: String(firstValue(record, ['PoleNumber', 'Pole'], '')),
    transformer: String(firstValue(record, ['Transformer'], '')),
    previousReading,
    currentReading: presentReadingRaw == null || presentReadingRaw === '' ? null : toNumber(presentReadingRaw),
    multiplier: toNumber(firstValue(record, ['Multiplier'], 1), 1) || 1,
    kwhUsed: record.computed_kwh == null ? null : toNumber(record.computed_kwh),
    billAmount: currentBill,
    penalty: Math.max(0, arrears),
    totalDue: currentBill + Math.max(0, arrears),
    dueDate: String(firstValue(record, ['Sched_DueDate', 'DueDate'], '')),
    disconnectionDate: String(firstValue(record, ['Sched_DisconnectionDate', 'DiscoDate'], '')),
    status: statusFor(record),
    gpsLat: gps.lat,
    gpsLng: gps.lng,
    remarks: String(firstValue(record, ['remarks', 'Remarks', 'FeedBackCode'], '')),
    bookNumber: String(firstValue(record, ['Book'], '')),
    areaCode: String(firstValue(record, ['Area'], '')),
    billMonth: String(firstValue(record, ['BillMonth', 'billmonth'], '')),
    meterPhoto: firstValue(record, ['meter_photo', 'MeterPhoto'], null),
    housePhoto: firstValue(record, ['house_photo', 'HousePhoto'], null),
    Read_Time: String(firstValue(record, ['Read_Time', 'read_time'], '')),
    updated_at: String(firstValue(record, ['updated_at'], '')),
    app_disconnected_at: String(firstValue(record, ['app_disconnected_at', 'date_disconnected', 'disconnected_at'], '')),
  };
}

async function listConsumers(db, options = {}) {
  const tableName = options.mode === 'disconnection' ? 'billhistory_disco' : 'reading';
  if (!(await tableExists(db, tableName))) return [];
  const rows =
    tableName === 'reading'
      ? await listReadingRecords(db, options.query || '', options.limit || 500)
      : await db.getAllAsync(
          `SELECT rowid AS _rowid, * FROM ${q(tableName)}
           ORDER BY CAST(Sequence AS INTEGER), AccountNumber
           LIMIT ?`,
          [options.limit || 500]
        );
  let consumers = await Promise.all(rows.map((row) => mapReadingToConsumerWithStatus(db, row, options)));
  if (options.status && options.status !== 'all') {
    consumers = consumers.filter((consumer) => consumer.status === options.status);
  }
  return consumers;
}

async function getConsumerById(db, id, options = {}) {
  const record = await getReadingRecord(db, id, options);
  return record ? mapReadingToConsumerWithStatus(db, record, options) : null;
}

async function getMapConsumerById(db, id, options = {}) {
  const mode = options.mode === 'disconnection' ? 'disconnection' : 'reading';
  const record = await getReadingRecord(db, id, { mode });
  if (!record) return null;

  if (mode !== 'reading') {
    return mapReadingToConsumer(record);
  }

  const historyRow = await getBillHistoryForRecord(db, record);
  if (!historyRow) return mapReadingToConsumer(record);

  const consumer = mapReadingToConsumer({
    ...record,
    ...historyRow,
    AccountNumber: historyRow.AccountNumber || record.AccountNumber,
    BillMonth: historyRow.BillMonth || record.BillMonth,
  });
  return { ...consumer, canCaptureGps: true };
}

async function getReadingAssignment(db, options = {}) {
  const tableName = options.mode === 'disconnection' ? 'billhistory_disco' : 'reading';
  const first = (await tableExists(db, tableName))
    ? await db.getFirstAsync(`SELECT * FROM ${q(tableName)} ORDER BY CAST(Sequence AS INTEGER), AccountNumber LIMIT 1`)
    : null;
  const collector = (await tableExists(db, 'collectors'))
    ? await db.getFirstAsync('SELECT Fullname, Username FROM collectors ORDER BY collector_id LIMIT 1')
    : null;

  return {
    areaCode: String(firstValue(first, ['Area'], '')),
    areaName: firstValue(first, ['Area'], '') ? `Area ${firstValue(first, ['Area'], '')}` : 'SQLite Assignment',
    bookNumber: String(firstValue(first, ['Book'], '')),
    billMonth: String(firstValue(first, ['BillMonth'], '')),
    readerName: String(firstValue(collector, ['Fullname', 'Username'], 'Field Reader')),
    prevReadingDate: String(firstValue(first, ['Sched_PrevRdngDate', 'PreviousReadingDate'], '')),
    presentReadingDate: String(firstValue(first, ['Sched_PresRdngDate', 'PresentReadingDate'], '')),
    dueDate: String(firstValue(first, ['Sched_DueDate', 'DueDate'], '')),
    disconnectionDate: String(firstValue(first, ['Sched_DisconnectionDate', 'DiscoDate'], '')),
  };
}

function latestValue(rows, fields) {
  return rows
    .map((row) => String(firstValue(row, fields, '') || '').trim())
    .filter(Boolean)
    .sort()
    .pop() || '';
}

function buildStats(consumers, payments = [], options = {}) {
  const totalAmountDue = consumers.reduce((sum, c) => sum + toNumber(c.totalDue), 0);
  const totalCollectionMonth = payments.reduce((sum, p) => sum + toNumber(firstValue(p, ['TotalBill', 'amountPaid'], 0)), 0);
  const today = new Date().toLocaleDateString('en-PH');
  const totalCollectionToday = payments
    .filter((p) => String(firstValue(p, ['date_paid', 'Read_Time'], '')).includes(today))
    .reduce((sum, p) => sum + toNumber(firstValue(p, ['TotalBill', 'amountPaid'], 0)), 0);

  return {
    totalRecords: consumers.length,
    readRecords: consumers.filter((c) => c.status === 'read').length,
    unreadRecords: consumers.filter((c) => c.status === 'unread').length,
    paidRecords: consumers.filter((c) => c.status === 'paid').length,
    disconnectedRecords: consumers.filter((c) => c.status === 'disconnected').length,
    problemReports: consumers.filter((c) => c.status === 'problem' || c.remarks).length,
    totalCollectionToday,
    totalCollectionMonth,
    totalAmountDue,
    lastReadingTimestamp: latestValue(consumers, ['updated_at', 'Read_Time', 'read_time']),
    lastDiscoTimestamp: latestValue(consumers, ['app_disconnected_at', 'date_disconnected', 'disconnected_at', 'updated_at']),
    mode: options.mode || 'reading',
  };
}

async function getDashboardSummary(db, options = {}) {
  const mode = options.mode === 'disconnection' ? 'disconnection' : options.mode === 'large_load' ? 'large_load' : 'reading';
  const consumers = await listConsumers(db, { limit: 10000, mode });
  const payTable = mode === 'disconnection' ? 'billhistory_disco_pay' : 'reading_pay';
  const payments = (await tableExists(db, payTable)) ? await db.getAllAsync(`SELECT * FROM ${q(payTable)}`) : [];
  return buildStats(consumers, payments, { mode });
}

async function getReportSummary(db, options = {}) {
  const mode = options.mode === 'disconnection' ? 'disconnection' : options.mode === 'large_load' ? 'large_load' : 'reading';
  const consumers = await listConsumers(db, { limit: 10000, mode });
  const payTable = mode === 'disconnection' ? 'billhistory_disco_pay' : 'reading_pay';
  const payments = (await tableExists(db, payTable)) ? await db.getAllAsync(`SELECT * FROM ${q(payTable)}`) : [];
  const assignment = await getReadingAssignment(db, { mode });
  const complaints = await getComplaintReports(db);
  return { assignment, stats: buildStats(consumers, payments, { mode }), payments, complaints, mode };
}

async function getDisconnectionCandidates(db) {
  const consumers = await listConsumers(db, { limit: 10000, mode: 'disconnection' });
  return consumers.filter((c) => c.status !== 'paid');
}

async function markConsumerDisconnected(db, id) {
  if (!(await tableExists(db, 'billhistory_disco'))) throw new Error('Disconnection table was not found.');
  await ensureColumn(db, 'billhistory_disco', 'app_disconnected_at', 'TEXT');
  await ensureColumn(db, 'billhistory_disco', 'is_synced', 'INTEGER DEFAULT 0');
  const ts = new Date().toISOString();
  const record = await getReadingRecord(db, id, { mode: 'disconnection' });
  if (!record) throw new Error('Disconnection record was not found.');
  const columns = await tableColumns(db, 'billhistory_disco');
  const key = record._rowid ? 'rowid' : columns.includes('Code') ? 'Code' : 'AccountNumber';
  const keyValue = record._rowid || record.Code || record.AccountNumber;
  const updates = ['app_disconnected_at = ?', 'is_synced = 0'];
  const params = [ts];
  if (columns.includes('StatusCode')) updates.push("StatusCode = 'D'");
  if (columns.includes('ConnStatus')) updates.push("ConnStatus = 'D'");
  if (columns.includes('date_disconnected')) {
    updates.push('date_disconnected = ?');
    params.push(ts);
  }
  if (columns.includes('disconnected_at')) {
    updates.push('disconnected_at = ?');
    params.push(ts);
  }
  if (columns.includes('updated_at')) {
    updates.push('updated_at = ?');
    params.push(ts);
  }
  params.push(String(keyValue));
  await db.runAsync(`UPDATE billhistory_disco SET ${updates.join(', ')} WHERE ${key} = ?`, params);
  return { ...record, app_disconnected_at: ts, status: 'disconnected' };
}

async function updateConsumerGps(db, id, lat, lng, options = {}) {
  const mode = options.mode === 'disconnection' ? 'disconnection' : 'reading';
  const record = await getReadingRecord(db, id, { mode });
  if (!record) throw new Error('Reading record not found in local SQLite.');

  if (mode === 'reading') {
    const historyRow = await getBillHistoryForRecord(db, record);
    if (!hasSavedReading(record) && !historyRow) {
      throw new Error('Save the reading first before capturing GPS.');
    }
    if (!historyRow && !(await tableExists(db, 'billhistory'))) {
      throw new Error('Bill history was not found. Save the reading first.');
    }
    if (!historyRow) {
      throw new Error('Bill history row was not found. Save the reading first.');
    }

    const columns = await tableColumns(db, 'billhistory');
    const code = firstValue(record, ['code', 'Code'], null);
    const account = String(firstValue(record, ['AccountNumber', 'accountnumber'], ''));
    const billMonth = String(firstValue(record, ['BillMonth', 'billmonth'], ''));
    const gpsStamp = `${lat},${lng}`;
    const updates = [];
    const params = [];

    if (columns.includes('app_gps_lat') || columns.includes('app_gps_lng')) {
      await ensureColumn(db, 'billhistory', 'app_gps_lat', 'REAL');
      await ensureColumn(db, 'billhistory', 'app_gps_lng', 'REAL');
      updates.push('app_gps_lat = ?', 'app_gps_lng = ?');
      params.push(lat, lng);
    }

    if (columns.includes('MLatLong') || columns.includes('HLatLong')) {
      if (columns.includes('MLatLong')) {
        updates.push('MLatLong = ?');
        params.push(gpsStamp);
      }
      if (columns.includes('HLatLong')) {
        updates.push('HLatLong = COALESCE(HLatLong, ?)');
        params.push(gpsStamp);
      }
    } else {
      await ensureColumn(db, 'billhistory', 'MLatLong', 'VARCHAR(225)');
      updates.push('MLatLong = ?');
      params.push(gpsStamp);
    }

    if (columns.includes('is_synced')) {
      updates.push('is_synced = 0');
    } else {
      await ensureColumn(db, 'billhistory', 'is_synced', 'INTEGER DEFAULT 0');
      updates.push('is_synced = 0');
    }

    if (columns.includes('updated_at')) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
    } else {
      await ensureColumn(db, 'billhistory', 'updated_at', 'TEXT');
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
    }

    const whereClause = code != null && columns.includes('Code') ? 'Code = ? AND BillMonth = ?' : 'AccountNumber = ? AND BillMonth = ?';
    const whereParams = code != null && columns.includes('Code') ? [String(code), billMonth] : [account, billMonth];
    await db.runAsync(`UPDATE billhistory SET ${updates.join(', ')} WHERE ${whereClause}`, [...params, ...whereParams]);
    return;
  }

  if (!(await tableExists(db, 'reading'))) throw new Error('Reading table was not found.');
  await ensureColumn(db, 'reading', 'app_gps_lat', 'REAL');
  await ensureColumn(db, 'reading', 'app_gps_lng', 'REAL');
  await ensureColumn(db, 'reading', 'is_synced', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'reading', 'updated_at', 'TEXT');
  const key = record._rowid ? 'rowid' : 'code';
  const keyValue = record._rowid || record.code;
  await db.runAsync(
    `UPDATE reading SET app_gps_lat = ?, app_gps_lng = ?, is_synced = 0, updated_at = ? WHERE ${key} = ?`,
    [lat, lng, new Date().toISOString(), keyValue]
  );
}

async function ensureComplaintSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY NOT NULL,
      accountnumber TEXT,
      serial_number TEXT,
      report_type TEXT,
      remarks TEXT,
      priority TEXT,
      assigned_team TEXT,
      photo_uri TEXT,
      status TEXT DEFAULT 'pending',
      is_synced INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);
}

async function saveComplaintReport(db, input) {
  await ensureComplaintSchema(db);
  await ensureColumn(db, 'complaints', 'serial_number', 'TEXT');
  const ts = new Date().toISOString();
  const id = input.id || `complaint-${Date.now()}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO complaints (
      id, accountnumber, serial_number, report_type, remarks, priority, assigned_team, photo_uri, status, is_synced, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, COALESCE((SELECT created_at FROM complaints WHERE id = ?), ?), ?)`,
    [
      id,
      input.accountNumber || '',
      input.serialNumber || '',
      input.reportType,
      input.remarks,
      input.priority,
      input.assignedTeam || '',
      input.photoUri || '',
      'pending',
      id,
      ts,
      ts,
    ]
  );
  return { ...input, id, status: 'pending', isSynced: false, createdAt: ts };
}

async function getComplaintReports(db, options = {}) {
  await ensureComplaintSchema(db);
  const limit = options.limit || 500;
  const rows = (await tableExists(db, 'reading'))
    ? await db.getAllAsync(
        `SELECT c.*, r.Name, r.Address, r.Area, r.Book, r.Sequence
           FROM complaints c
           LEFT JOIN reading r ON r.AccountNumber = c.accountnumber
          ORDER BY c.created_at DESC
          LIMIT ?`,
        [limit]
      )
    : await db.getAllAsync(`SELECT c.* FROM complaints c ORDER BY c.created_at DESC LIMIT ?`, [limit]);
  return rows.map((row) => ({
    id: row.id,
    accountNumber: String(row.accountnumber || ''),
    serialNumber: String(row.serial_number || ''),
    consumerName: String(row.Name || ''),
    address: String(row.Address || ''),
    reportType: String(row.report_type || ''),
    remarks: String(row.remarks || ''),
    priority: String(row.priority || 'normal'),
    assignedTeam: String(row.assigned_team || ''),
    status: String(row.status || 'pending'),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    area: String(row.Area || ''),
    book: String(row.Book || ''),
    sequence: String(row.Sequence || ''),
  }));
}

async function getSyncSummary(db) {
  const modules = [
    { module: 'Readings', table: 'reading' },
    { module: 'Invoices', table: 'invoices' },
    { module: 'Payments', table: 'reading_pay' },
    { module: 'Complaints', table: 'complaints' },
    { module: 'Bill History', table: 'billhistory' },
  ];

  const result = [];
  for (const item of modules) {
    const columns = await tableColumns(db, item.table);
    if (columns.length === 0 || !columns.includes('is_synced')) {
      result.push({ module: item.module, pendingCount: 0, syncedCount: 0, failedCount: 0, lastSync: null });
      continue;
    }
    const pending = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${q(item.table)} WHERE COALESCE(is_synced, 0) = 0`);
    const synced = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${q(item.table)} WHERE COALESCE(is_synced, 0) = 1`);
    const last = columns.includes('updated_at')
      ? await db.getFirstAsync(`SELECT MAX(updated_at) AS lastSync FROM ${q(item.table)} WHERE COALESCE(is_synced, 0) = 1`)
      : null;
    result.push({
      module: item.module,
      pendingCount: pending?.n ?? 0,
      syncedCount: synced?.n ?? 0,
      failedCount: 0,
      lastSync: last?.lastSync ?? null,
    });
  }
  return result;
}

module.exports = {
  getConsumerById,
  getDashboardSummary,
  getDisconnectionCandidates,
  getReadingAssignment,
  getReportSummary,
  getMapConsumerById,
  getComplaintReports,
  getSyncSummary,
  listConsumers,
  markConsumerDisconnected,
  mapReadingToConsumer,
  saveComplaintReport,
  updateConsumerGps,
};
