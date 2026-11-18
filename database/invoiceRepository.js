const { computeInvoice, computeNetMeteringInvoice } = require('../services/invoiceCalculator');
const { isActiveFlag, roundMoney, toNumber } = require('../services/discountCalculator');

const APP_READING_COLUMNS = [
  ['present_reading', 'REAL'],
  ['computed_kwh', 'REAL'],
  ['Demand', 'REAL DEFAULT 0'],
  ['total_bill', 'REAL'],
  ['lifeline_discount', 'REAL DEFAULT 0'],
  ['senior_discount', 'REAL DEFAULT 0'],
  ['net_metering_credit', 'REAL DEFAULT 0'],
  ['net_metering_previous_credit', 'REAL DEFAULT 0'],
  ['flag_surcharge', 'INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1))'],
  ['surcharge_amount', 'REAL NOT NULL DEFAULT 0'],
  ['meter_photo', 'TEXT'],
  ['house_photo', 'TEXT'],
  ['invoice_status', "TEXT DEFAULT 'pending'"],
  ['is_synced', 'INTEGER DEFAULT 0'],
  ['updated_at', 'TEXT'],
];

const INVOICE_UPSERT_SQL = `INSERT OR REPLACE INTO invoices (
      id, accountnumber, billmonth, previous_reading, present_reading, multiplier, computed_kwh,
       generation_subtotal, transmission_subtotal, distribution_subtotal, other_charges_total, ancillary_subtotal,
      vat_total, lifeline_discount, senior_discount, net_metering_credit, flag_surcharge, surcharge_amount, total_before_discount,
      total_bill, due_date, disconnection_date, is_paid, official_receipt_no, is_synced,
      invoice_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM invoices WHERE id = ?), ?), ?)`;

function buildInvoiceUpsertParams(id, readingRecord, invoice, printable, ts) {
  return [
    id,
    printable.accountNumber || readingRecord.AccountNumber,
    printable.billMonth || readingRecord.BillMonth,
    invoice.previousReading,
    invoice.presentReading,
    invoice.multiplier,
    invoice.computedKwh,
    invoice.generationSubtotal,
    invoice.transmissionSubtotal,
    invoice.distributionSubtotal,
    invoice.otherChargesTotal,
    invoice.ancillarySubtotal || 0,
    invoice.vatSubtotal,
    invoice.lifelineDiscount,
    invoice.seniorDiscount,
    invoice.netMeteringCredit || 0,
    printable.flagSurcharge ? 1 : 0,
    printable.flagSurcharge ? Math.max(0, toNumber(printable.surchargeAmount)) : 0,
    invoice.totalBeforeDiscount,
    invoice.totalBill,
    printable.dueDate || readingRecord.Sched_DueDate,
    printable.disconnectionDate || readingRecord.Sched_DisconnectionDate,
    readingRecord.flag_paid || 0,
    printable.officialReceiptNo || readingRecord.ornumber || '',
    0,
    JSON.stringify({ ...invoice, id }),
    id,
    ts,
    ts,
  ];
}

function nowIso() {
  return new Date().toISOString();
}

function q(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function tableColumns(db, tableName) {
  const rows = await db.getAllAsync(`PRAGMA table_info(${q(tableName)})`);
  return rows.map((row) => row.name);
}

async function tableExists(db, tableName) {
  const row = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1", [
    tableName,
  ]);
  return Boolean(row);
}

async function ensureColumn(db, tableName, name, type) {
  if (!(await tableExists(db, tableName))) return;
  const columns = await tableColumns(db, tableName);
  if (!columns.includes(name)) await db.execAsync(`ALTER TABLE ${q(tableName)} ADD COLUMN ${q(name)} ${type}`);
}

function hasColumn(columns, column) {
  return columns.includes(column);
}

function firstValue(record, fields, fallback = null) {
  for (const field of fields) {
    if (record?.[field] != null && record[field] !== '') return record[field];
  }
  return fallback;
}

function isDiscoMode(options = {}) {
  return options.mode === 'disconnection' || options.source === 'disconnection';
}

function modeTables(options = {}) {
  return isDiscoMode(options)
    ? {
        source: 'disconnection',
        reading: 'billhistory_disco',
        history: 'billhistory_disco',
        arrears: 'billhistory_disco_arrears',
        pay: 'billhistory_disco_pay',
      }
    : {
        source: 'reading',
        reading: 'reading',
        history: 'billhistory',
        arrears: 'billhistory_arrears',
        pay: 'reading_pay',
      };
}

async function getCollectorName(db, collectorCode) {
  if (!collectorCode || !(await tableExists(db, 'collectors'))) return '';
  const row = await db.getFirstAsync(
    `SELECT Fullname, Username FROM collectors
     WHERE CAST(collector_id AS TEXT) = CAST(? AS TEXT)
        OR lower(trim(CAST(Username AS TEXT))) = lower(trim(CAST(? AS TEXT)))
     LIMIT 1`,
    [String(collectorCode), String(collectorCode)]
  );
  return String(firstValue(row, ['Fullname', 'Username'], ''));
}

function getBreakdownAmount(invoice, field) {
  const groups = Object.values(invoice.breakdown || {});
  for (const group of groups) {
    const item = (group || []).find((entry) => entry.field === field);
    if (item) return toNumber(item.amount);
  }
  return 0;
}

function parseArrearsBreakdown(readingRecord) {
  const raw = String(readingRecord.total_amount_breakdown || '').trim();
  const entries = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^([^-]+)-(.+)$/);
      if (!match) return null;
      return {
        billMonth: match[1].trim(),
        amount: roundMoney(toNumber(match[2])),
      };
    })
    .filter(Boolean);

  if (entries.length > 0) return entries;

  const balance = roundMoney(toNumber(readingRecord.balance_previous));
  if (String(readingRecord.flag_withprevious || '').toUpperCase() === 'Y' && balance > 0) {
    return [{ billMonth: null, amount: balance }];
  }
  return [];
}

async function ensureInvoiceSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      accountnumber TEXT,
      billmonth TEXT,
      previous_reading REAL,
      present_reading REAL,
      multiplier REAL,
      computed_kwh REAL,
      generation_subtotal REAL,
      transmission_subtotal REAL,
      distribution_subtotal REAL,
       other_charges_total REAL,
       ancillary_subtotal REAL DEFAULT 0,
      vat_total REAL,
      lifeline_discount REAL,
      senior_discount REAL,
      net_metering_credit REAL,
      flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1)),
      surcharge_amount REAL NOT NULL DEFAULT 0,
      total_before_discount REAL,
      total_bill REAL,
      due_date TEXT,
      disconnection_date TEXT,
      is_paid INTEGER DEFAULT 0,
      official_receipt_no TEXT,
      is_synced INTEGER DEFAULT 0,
      invoice_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  const invoiceColumns = await tableColumns(db, 'invoices');
  if (!invoiceColumns.includes('ancillary_subtotal')) {
    await db.execAsync('ALTER TABLE invoices ADD COLUMN ancillary_subtotal REAL DEFAULT 0');
  }
  await ensureColumn(db, 'invoices', 'flag_surcharge', 'INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1))');
  await ensureColumn(db, 'invoices', 'surcharge_amount', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'billhistory', 'AncillaryCharge', 'REAL DEFAULT 0');
  await ensureColumn(db, 'billhistory', 'EVAT_Ancillary', 'REAL DEFAULT 0');
  await ensureColumn(db, 'billhistory', 'flag_surcharge', 'INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1))');
  await ensureColumn(db, 'billhistory', 'surcharge_amount', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn(db, 'billhistory_disco', 'flag_surcharge', 'INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1))');
  await ensureColumn(db, 'billhistory_disco', 'surcharge_amount', 'REAL NOT NULL DEFAULT 0');

  const columns = await tableColumns(db, 'reading');
  for (const [name, type] of APP_READING_COLUMNS) {
    if (!columns.includes(name)) {
      await db.execAsync(`ALTER TABLE reading ADD COLUMN ${q(name)} ${type}`);
    }
  }
}

async function getReadingRecord(db, id, options = {}) {
  await ensureInvoiceSchema(db);
  const tableName = modeTables(options).reading;
  if (!(await tableExists(db, tableName))) return null;
  const value = String(id);
  if (value === 'first') {
    return db.getFirstAsync(
      `SELECT rowid AS _rowid, * FROM ${q(tableName)} ORDER BY CAST(Sequence AS INTEGER), AccountNumber LIMIT 1`
    );
  }
  const numeric = Number(value);
  const byCode = Number.isFinite(numeric)
    ? await db.getFirstAsync(
        `SELECT rowid AS _rowid, * FROM ${q(tableName)} WHERE ${tableName === 'reading' ? 'code' : 'Code'} = ? LIMIT 1`,
        [numeric]
      )
    : null;
  if (byCode) return byCode;

  const byAccount = await db.getFirstAsync(`SELECT rowid AS _rowid, * FROM ${q(tableName)} WHERE AccountNumber = ? LIMIT 1`, [
    value,
  ]);
  if (byAccount) return byAccount;

  if (Number.isFinite(numeric)) {
    return db.getFirstAsync(`SELECT rowid AS _rowid, * FROM ${q(tableName)} WHERE rowid = ? LIMIT 1`, [numeric]);
  }

  return null;
}

async function listReadingRecords(db, query = '', limit = 50) {
  await ensureInvoiceSchema(db);
  const qValue = `%${query.trim()}%`;
  if (!query.trim()) {
    return db.getAllAsync(
      'SELECT rowid AS _rowid, * FROM reading ORDER BY CAST(Sequence AS INTEGER), AccountNumber LIMIT ?',
      [limit]
    );
  }
  return db.getAllAsync(
    `SELECT rowid AS _rowid, * FROM reading
     WHERE AccountNumber LIKE ? OR Name LIKE ? OR Address LIKE ? OR Serial LIKE ? OR Sequence LIKE ?
     ORDER BY CAST(Sequence AS INTEGER), AccountNumber
     LIMIT ?`,
    [qValue, qValue, qValue, qValue, qValue, limit]
  );
}

function invoiceIdFor(readingRecord, invoice) {
  const account = readingRecord.AccountNumber || readingRecord.code || 'unknown';
  const billMonth = readingRecord.BillMonth || 'unknown';
  const mode = invoice.netMetering ? 'NM' : 'RDG';
  return `${account}-${billMonth}-${mode}`;
}

function mapBillHistoryRow(readingRecord, invoice, id) {
  const totalVat = roundMoney(invoice.vatSubtotal);
  return {
    Code: firstValue(readingRecord, ['code', 'Code'], 0),
    Area: readingRecord.Area,
    Book: readingRecord.Book,
    Sequence: readingRecord.Sequence,
    AccountNumber: readingRecord.AccountNumber,
    Name: readingRecord.Name,
    Address: readingRecord.Address,
    RateCode: readingRecord.RateCode,
    Serial: readingRecord.Serial,
    Multiplier: invoice.multiplier,
    PreviousReadingDate: readingRecord.Sched_PrevRdngDate,
    PresentReadingDate: readingRecord.Sched_PresRdngDate,
    PresentReadingKWH: invoice.presentReading,
    PreviousReadingKWH: invoice.previousReading,
    Diff: invoice.computedKwh,
    Demand: invoice.demandKwh || 0,
    FlatRateWattage: readingRecord.flat_rate_kwhr || 0,
    FeedBackCode: '',
    CM: readingRecord.flag_cm || 'N',
    CMMultiplier: readingRecord.Multiplier || 1,
    CMPreviousReadingKWH: readingRecord.CMLastReading_KWH || 0,
    CMPresentReadingKWH: readingRecord.CMInitialReading_KWH || 0,
    CMKilowattHour: 0,
    CMDemand: 0,
    KilowattHour: invoice.computedKwh,
    KilowattUsed: invoice.billableKwh,
    GenSysCharge: getBreakdownAmount(invoice, 'Rate_GenSysCharge'),
    HostCommCharge: getBreakdownAmount(invoice, 'Rate_HostCommCharge'),
    ForexCharge: getBreakdownAmount(invoice, 'Rate_ForexCharge'),
    FPCA: getBreakdownAmount(invoice, 'Rate_FPCA'),
    TCDemandCharge: getBreakdownAmount(invoice, 'Rate_TCDemandCharge'),
    TCTransSystemCharge: getBreakdownAmount(invoice, 'Rate_TCTransSystemCharge'),
    SystemLossCharge: getBreakdownAmount(invoice, 'Rate_SystemLossCharge'),
    DCDemandCharge: getBreakdownAmount(invoice, 'Rate_DCDemandCharge'),
    DCDistributionCharge: getBreakdownAmount(invoice, 'Rate_DCDistributionCharge'),
    SCRetCustCharge: getBreakdownAmount(invoice, 'Rate_SCRetCustCharge'),
    SCSupplySysCharge: getBreakdownAmount(invoice, 'Rate_SCSupplySysCharge'),
    MCRetailCustCharge: getBreakdownAmount(invoice, 'Rate_MCRetailCustCharge'),
    MCSystemCharge: getBreakdownAmount(invoice, 'Rate_MCSystemCharge'),
    UCNPCStrandedDebts: getBreakdownAmount(invoice, 'Rate_UCNPCStrandedDebts'),
    UCNPCStrandedContCost: getBreakdownAmount(invoice, 'Rate_UCNPCStrandedContCost'),
    UCDUStrandedContCost: getBreakdownAmount(invoice, 'Rate_UCDUStrandedContCost'),
    UCME: getBreakdownAmount(invoice, 'Rate_UCME'),
    UCEqTaxesAndRoyalties: getBreakdownAmount(invoice, 'Rate_UCEqTaxesAndRoyalties'),
    UCEC: getBreakdownAmount(invoice, 'Rate_UCEC'),
    UCCrossSubRemoval: getBreakdownAmount(invoice, 'Rate_UCCrossSubRemoval'),
    ICCrossSubsidyCharge: getBreakdownAmount(invoice, 'Rate_ICCrossSubsidyCharge'),
    PowerActRateRed: getBreakdownAmount(invoice, 'Rate_PowerActRateRed'),
    LifelineDiscSubs: invoice.lifelineDiscount,
    LoanCondo: getBreakdownAmount(invoice, 'Rate_LoanCondo'),
    LoanCondoRetail: getBreakdownAmount(invoice, 'Rate_LoanCondoRetail'),
    MCC: getBreakdownAmount(invoice, 'Rate_MCC'),
    MCC_Substation: getBreakdownAmount(invoice, 'Rate_MCC_Substation'),
    FitAll: getBreakdownAmount(invoice, 'Rate_FitAll'),
    TransformerRental: 0,
    AncillaryCharge: invoice.ancillarySubtotal || 0,
    Rate_AncillaryCharge: invoice.breakdown?.ancillary?.[0]?.rate || 0,
    EVAT_Ancillary: getBreakdownAmount(invoice, 'EVAT_Ancillary'),
    TotalBill: invoice.totalBill,
    flag_surcharge: invoice.printableInvoice?.flagSurcharge ? 1 : 0,
    surcharge_amount: invoice.printableInvoice?.flagSurcharge
      ? Math.max(0, toNumber(invoice.printableInvoice?.surchargeAmount))
      : 0,
    BillNumber: firstValue(readingRecord, ['billno', 'BillNumber'], id),
    OEBRNumber: '',
    BillMonth: readingRecord.BillMonth,
    StatusCode: readingRecord.ConnStatus || '',
    Grid: readingRecord.Grid,
    GrossKilowattHour: invoice.netMetering?.importKwh || 0,
    LessKilowattHour: invoice.netMetering?.exportKwh || 0,
    SumBillMonth: readingRecord.BillMonth,
    EVAT: totalVat,
    flag_paid: readingRecord.flag_paid === 1 || readingRecord.flag_paid === 'Y' ? 'Y' : 'N',
    date_paid: readingRecord.date_paid,
    collector_code: readingRecord.collector_code || invoice.collectorCode || '',
    schedrdingid: readingRecord.Sched_ID,
    DiscoDate: readingRecord.Sched_DisconnectionDate,
    high_low: '0',
    Read_Time: new Date().toLocaleString(),
    tries_count: readingRecord.tries_count || 0,
    print_count: readingRecord.flag_printed || 0,
    occ_flag: readingRecord.OCC_flag,
    ornumber: readingRecord.ornumber,
    flag_withprevious: readingRecord.flag_withprevious,
    balance_previous: readingRecord.balance_previous || 0,
    senior_citizen_disc: invoice.seniorDiscount,
    senior_citizen_subsidy: firstValue(readingRecord, ['senior_subsidy', 'senior_subsid'], 0),
    EVAT_GenCharge: getBreakdownAmount(invoice, 'EVAT_GenCharge') || getBreakdownAmount(invoice, 'Vat_GenCharge'),
    EVAT_SystemLoss: getBreakdownAmount(invoice, 'EVAT_SystemLoss') || getBreakdownAmount(invoice, 'Vat_SystemLoss'),
    EVAT_Trans_Charge: getBreakdownAmount(invoice, 'EVAT_Trans_Charge') || getBreakdownAmount(invoice, 'Vat_Trans_Charge'),
    EVAT_Dist_Charge: getBreakdownAmount(invoice, 'EVAT_Dist_Charge') || getBreakdownAmount(invoice, 'Vat_Dist_Charge'),
    EVAT_OtherVat: getBreakdownAmount(invoice, 'EVAT_OtherVat') || getBreakdownAmount(invoice, 'Vat_Other'),
    GenRefund: getBreakdownAmount(invoice, 'Rate_GenRefund'),
    TransRefund: getBreakdownAmount(invoice, 'Rate_TransRefund'),
    SysLossRefund: getBreakdownAmount(invoice, 'Rate_SysLossRefund'),
    LifelineCollect: getBreakdownAmount(invoice, 'Rate_LifelineCollect'),
    SeniorRefund: getBreakdownAmount(invoice, 'Rate_SeniorRefund'),
    RPPD: getBreakdownAmount(invoice, 'Rate_RPPD'),
    ICCS: getBreakdownAmount(invoice, 'Rate_ICCS'),
    Trueup: getBreakdownAmount(invoice, 'Rate_Trueup'),
    UCME_Redci: getBreakdownAmount(invoice, 'Rate_UCME_Redci'),
    RealPropertyTax: getBreakdownAmount(invoice, 'Rate_RealPropertyTax'),
    GEA_ALL: getBreakdownAmount(invoice, 'RATE_GEA_ALL'),
    REX: getBreakdownAmount(invoice, 'RATE_REX'),
  };
}

function addOccFields(row, readingRecord, invoice) {
  for (let index = 1; index <= 10; index += 1) {
    row[`OCCode${index}`] = readingRecord[`OCCode${index}`] || '';
    row[`OCAmount${index}`] = readingRecord[`OCAmount${index}`] || 0;
    row[`OCMo${index}`] = 0;
    row[`OCTotal${index}`] = readingRecord[`OCAmount${index}`] || 0;
    row[`OCFlag${index}_Vat`] = readingRecord[`OCFlag${index}_Vat`] || 0;
  }
  row.OCTotal = invoice.otherChargesTotal;
  return row;
}

function addRateSnapshot(row, readingRecord) {
  Object.keys(readingRecord || {}).forEach((key) => {
    if (/^Rate_/i.test(key) || /^Vat_/i.test(key)) {
      row[key] = readingRecord[key];
    }
  });
  return row;
}

async function insertMappedRow(db, tableName, values) {
  const columns = await tableColumns(db, tableName);
  const insertColumns = Object.keys(values).filter((column) => hasColumn(columns, column));
  if (insertColumns.length === 0) return;
  const placeholders = insertColumns.map(() => '?').join(', ');
  await db.runAsync(
    `INSERT INTO ${q(tableName)} (${insertColumns.map(q).join(', ')}) VALUES (${placeholders})`,
    insertColumns.map((column) => values[column])
  );
}

async function saveBillHistory(db, readingRecord, invoice, id) {
  if (!(await tableExists(db, 'billhistory'))) return;
  const code = firstValue(readingRecord, ['code', 'Code'], null);
  const columns = await tableColumns(db, 'billhistory');
  if (code != null && hasColumn(columns, 'Code')) {
    await db.runAsync('DELETE FROM billhistory WHERE Code = ? AND BillMonth = ?', [String(code), String(readingRecord.BillMonth)]);
  } else {
    await db.runAsync('DELETE FROM billhistory WHERE AccountNumber = ? AND BillMonth = ?', [
      String(readingRecord.AccountNumber),
      String(readingRecord.BillMonth),
    ]);
  }
  const row = addRateSnapshot(addOccFields(mapBillHistoryRow(readingRecord, invoice, id), readingRecord, invoice), readingRecord);
  await insertMappedRow(db, 'billhistory', row);
}

async function saveBillHistoryArrears(db, readingRecord) {
  if (!(await tableExists(db, 'billhistory_arrears'))) return;
  const arrears = parseArrearsBreakdown(readingRecord);
  if (arrears.length === 0) return;

  for (const arrear of arrears) {
    if (arrear.billMonth) {
      const code = firstValue(readingRecord, ['code', 'Code'], null);
      const arrearsColumns = await tableColumns(db, 'billhistory_arrears');
      const historyColumns = await tableColumns(db, 'billhistory');
      if (code != null && hasColumn(arrearsColumns, 'Code')) {
        await db.runAsync('DELETE FROM billhistory_arrears WHERE Code = ? AND BillMonth = ?', [String(code), String(arrear.billMonth)]);
      } else {
        await db.runAsync('DELETE FROM billhistory_arrears WHERE AccountNumber = ? AND BillMonth = ?', [
          String(readingRecord.AccountNumber),
          String(arrear.billMonth),
        ]);
      }
      const source =
        code != null && hasColumn(historyColumns, 'Code')
          ? await db.getFirstAsync('SELECT * FROM billhistory WHERE Code = ? AND BillMonth = ? LIMIT 1', [
              String(code),
              String(arrear.billMonth),
            ])
          : await db.getFirstAsync('SELECT * FROM billhistory WHERE AccountNumber = ? AND BillMonth = ? LIMIT 1', [
              String(readingRecord.AccountNumber),
              String(arrear.billMonth),
            ]);
      if (source) {
        await insertMappedRow(db, 'billhistory_arrears', {
          ...source,
          flag_withprevious: readingRecord.flag_withprevious,
          balance_previous: arrear.amount,
        });
        continue;
      }
    }

    await insertMappedRow(db, 'billhistory_arrears', {
      Code: firstValue(readingRecord, ['code', 'Code'], 0),
      Area: readingRecord.Area,
      Book: readingRecord.Book,
      Sequence: readingRecord.Sequence,
      AccountNumber: readingRecord.AccountNumber,
      Name: readingRecord.Name,
      Address: readingRecord.Address,
      RateCode: readingRecord.RateCode,
      Serial: readingRecord.Serial,
      Multiplier: readingRecord.Multiplier || 1,
      BillMonth: arrear.billMonth || readingRecord.BillMonth,
      BillNumber: readingRecord.billno,
      TotalBill: arrear.amount,
      flag_paid: 'N',
      flag_withprevious: readingRecord.flag_withprevious,
      balance_previous: arrear.amount,
      schedrdingid: readingRecord.Sched_ID,
      DiscoDate: readingRecord.Sched_DisconnectionDate,
    });
  }
}

async function getReadingPayment(db, readingRecord, options = {}) {
  const payTable = modeTables(options).pay;
  if (!(await tableExists(db, payTable))) return null;
  const code = firstValue(readingRecord, ['code', 'Code'], null);
  const columns = await tableColumns(db, payTable);
  if (code != null && hasColumn(columns, 'Code')) {
    const row = await db.getFirstAsync(
      `SELECT * FROM ${q(payTable)} WHERE Code = ? AND BillMonth = ? ORDER BY date_paid DESC LIMIT 1`,
      [String(code), String(readingRecord.BillMonth)]
    );
    if (row) return row;
  }
  return db.getFirstAsync(
    `SELECT * FROM ${q(payTable)} WHERE AccountNumber = ? AND BillMonth = ? ORDER BY date_paid DESC LIMIT 1`,
    [String(readingRecord.AccountNumber), String(readingRecord.BillMonth)]
  );
}

async function getArrearsRows(db, readingRecord, options = {}) {
  const arrearsTable = modeTables(options).arrears;
  if (!(await tableExists(db, arrearsTable))) return [];
  const code = firstValue(readingRecord, ['code', 'Code'], null);
  const columns = await tableColumns(db, arrearsTable);
  if (code != null && hasColumn(columns, 'Code')) {
    const rows = await db.getAllAsync(
      `SELECT * FROM ${q(arrearsTable)}
       WHERE Code = ? AND COALESCE(flag_paid, 'N') <> 'Y'
       ORDER BY BillMonth`,
      [String(code)]
    );
    if (rows.length > 0) return rows;
  }
  return db.getAllAsync(
    `SELECT * FROM ${q(arrearsTable)}
     WHERE AccountNumber = ? AND COALESCE(flag_paid, 'N') <> 'Y'
     ORDER BY BillMonth`,
    [String(readingRecord.AccountNumber)]
  );
}

async function getBillHistoryForReading(db, readingRecord, options = {}) {
  const historyTable = modeTables(options).history;
  if (!(await tableExists(db, historyTable))) return null;
  if (historyTable === modeTables(options).reading && readingRecord) return readingRecord;
  const code = firstValue(readingRecord, ['code', 'Code'], null);
  const columns = await tableColumns(db, historyTable);
  if (code != null && hasColumn(columns, 'Code')) {
    const row = await db.getFirstAsync(
      `SELECT * FROM ${q(historyTable)} WHERE Code = ? AND BillMonth = ? ORDER BY rowid DESC LIMIT 1`,
      [String(code), String(readingRecord.BillMonth)]
    );
    if (row) return row;
  }
  return db.getFirstAsync(`SELECT * FROM ${q(historyTable)} WHERE AccountNumber = ? AND BillMonth = ? ORDER BY rowid DESC LIMIT 1`, [
    String(readingRecord.AccountNumber),
    String(readingRecord.BillMonth),
  ]);
}

async function getPreviousNetMeteringCredit(db, readingRecord, options = {}) {
  const historyTable = modeTables(options).history;
  if (!(await tableExists(db, historyTable))) return 0;
  const columns = await tableColumns(db, historyTable);
  if (!hasColumn(columns, 'TotalBill')) return 0;

  const row = await db.getFirstAsync(
    `SELECT TotalBill FROM ${q(historyTable)}
     WHERE AccountNumber = ?
       AND COALESCE(BillMonth, '') <> ?
       AND CAST(COALESCE(TotalBill, 0) AS REAL) < 0
     ORDER BY BillMonth DESC, rowid DESC
     LIMIT 1`,
    [String(readingRecord.AccountNumber), String(readingRecord.BillMonth || '')]
  );
  return row ? roundMoney(toNumber(row.TotalBill)) : 0;
}

function isReadingPaid(readingRecord, payment = null, bill = null) {
  return (
    Boolean(payment) ||
    readingRecord.flag_paid === 1 ||
    readingRecord.flag_paid === '1' ||
    readingRecord.flag_paid === 'Y' ||
    bill?.flag_paid === 1 ||
    bill?.flag_paid === '1' ||
    bill?.flag_paid === 'Y'
  );
}

async function getPaymentSummary(db, id, options = {}) {
  const readingRecord = await getReadingRecord(db, id, options);
  if (!readingRecord) throw new Error('Reading record not found in local SQLite.');
  const bill = await getBillHistoryForReading(db, readingRecord, options);
  const payment = await getReadingPayment(db, readingRecord, options);
  const arrears = await getArrearsRows(db, readingRecord, options);
  const arrearsTotal = roundMoney(
    arrears.reduce((sum, row) => sum + toNumber(row.TotalBill || row.balance_previous), 0) || toNumber(readingRecord.balance_previous)
  );
  const billAmount = roundMoney(toNumber(bill?.TotalBill ?? readingRecord.total_bill ?? 0));
  const totalDue = roundMoney(billAmount + arrearsTotal);

  return {
    readingRecord,
    bill,
    payment,
    arrears,
    isPaid: isReadingPaid(readingRecord, payment, bill),
    billAmount,
    arrearsTotal,
    totalDue,
    source: modeTables(options).source,
  };
}

async function billHistoryToInvoice(db, row, readingRecord = null, options = {}) {
  if (!row) return null;
  const record = readingRecord || row;
  const payment = await getReadingPayment(db, record, options);
  const isPaid = isReadingPaid(record, payment, row);
  const officialReceiptNo = payment?.ornumber || row.ornumber || record.ornumber || '';
  const meterReaderName =
    (await getCollectorName(db, row.collector_code || record.collector_code || payment?.collector_code)) ||
    row.collector_code ||
    record.collector_code ||
    '';
  const importKwh = toNumber(row.GrossKilowattHour ?? record.GrossKilowattHour);
  const exportKwh = toNumber(row.LessKilowattHour ?? record.LessKilowattHour);
  const netMeteringCredit = toNumber(record.net_metering_credit ?? row.net_metering_credit);
  const netMeteringPreviousCredit = toNumber(record.net_metering_previous_credit ?? row.net_metering_previous_credit);
  const isNetMetering = importKwh !== 0 || exportKwh !== 0 || netMeteringCredit !== 0 || String(modeTables(options).source).toLowerCase().includes('net');
  const netMeteringExportCredit = roundMoney(netMeteringCredit - netMeteringPreviousCredit);
  const invoice = {
    id: invoiceIdFor(record, { netMetering: false }),
    computedKwh: toNumber(row.KilowattHour ?? row.Diff),
    billableKwh: toNumber(row.KilowattUsed ?? row.KilowattHour),
    previousReading: toNumber(row.PreviousReadingKWH),
    presentReading: toNumber(row.PresentReadingKWH),
    multiplier: toNumber(row.Multiplier, 1) || 1,
    demandKwh: toNumber(row.Demand),
    generationSubtotal: roundMoney(
      toNumber(row.GenSysCharge) +
        toNumber(row.HostCommCharge) +
        toNumber(row.ForexCharge) +
        toNumber(row.FPCA) +
        toNumber(row.GEA_ALL) +
        toNumber(row.REX) +
        toNumber(row.GenRefund)
    ),
    transmissionSubtotal: roundMoney(toNumber(row.TCDemandCharge) + toNumber(row.TCTransSystemCharge) + toNumber(row.TransRefund)),
    systemLossSubtotal: roundMoney(toNumber(row.SystemLossCharge) + toNumber(row.SysLossRefund)),
    distributionSubtotal: roundMoney(
      toNumber(row.DCDemandCharge) +
        toNumber(row.DCDistributionCharge) +
        toNumber(row.SCRetCustCharge) +
        toNumber(row.SCSupplySysCharge) +
        toNumber(row.MCRetailCustCharge) +
        toNumber(row.MCSystemCharge) +
        toNumber(row.MCC) +
        toNumber(row.MCC_Substation) +
        toNumber(row.LoanCondo) +
        toNumber(row.LoanCondoRetail)
    ),
    otherChargesTotal: roundMoney(
      Array.from({ length: 10 }, (_, index) => toNumber(row[`OCAmount${index + 1}`])).reduce(
        (sum, amount) => sum + amount,
        0
      )
    ),
    ancillarySubtotal: roundMoney(toNumber(row.AncillaryCharge)),
    vatSubtotal: toNumber(row.EVAT),
    lifelineDiscount: toNumber(row.LifelineDiscSubs),
    seniorDiscount: toNumber(row.senior_citizen_disc),
    netMeteringCredit,
    netMeteringExportCredit,
    netMeteringPreviousCredit,
    ...(isNetMetering ? { netMetering: { importKwh, exportKwh, netKwh: importKwh - exportKwh, credit: netMeteringCredit, exportGenerationCredit: netMeteringExportCredit, previousMonthCredit: netMeteringPreviousCredit } } : {}),
    totalBeforeDiscount: roundMoney(toNumber(row.TotalBill) - toNumber(row.LifelineDiscSubs) - toNumber(row.senior_citizen_disc)),
    totalBill: toNumber(row.TotalBill),
    warnings: [],
    breakdown: {
      ancillary: [
        {
          field: 'AncillaryCharge',
          rate: toNumber(row.Rate_AncillaryCharge ?? row.Rate_Ancillary),
          amount: roundMoney(toNumber(row.AncillaryCharge)),
          isFixed: Boolean(toNumber(row.AncillaryAmount)),
        },
      ],
      vat: [
        {
          field: 'EVAT_Ancillary',
          rate: toNumber(row.Vat_Ancillary ?? row.EVAT_Ancillary),
          amount: roundMoney(toNumber(row.EVAT_Ancillary)),
          isFixed: false,
        },
      ],
    },
    discounts: {
      lifelineDiscount: toNumber(row.LifelineDiscSubs),
      seniorDiscount: toNumber(row.senior_citizen_disc),
      lifelineEligible: toNumber(row.LifelineDiscSubs) < 0,
      seniorEligible: toNumber(row.senior_citizen_disc) < 0,
    },
    printableInvoice: {
      referenceNumber: row.BillNumber || record.billno,
      accountNumber: row.AccountNumber,
      consumerName: row.Name,
      address: row.Address,
      area: row.Area,
      book: row.Book,
      sequence: row.Sequence,
      serialNumber: row.Serial,
      billMonth: row.BillMonth,
      rateCode: row.RateCode,
      previousReading: toNumber(row.PreviousReadingKWH),
      presentReading: toNumber(row.PresentReadingKWH),
      previousReadingDate: row.PreviousReadingDate || record.Sched_PrevRdngDate,
      presentReadingDate: row.PresentReadingDate || record.Sched_PresRdngDate,
      multiplier: toNumber(row.Multiplier, 1) || 1,
      demandKwh: toNumber(row.Demand),
      computedKwh: toNumber(row.KilowattHour ?? row.Diff),
      ...(isNetMetering ? {
        importKwh,
        exportKwh,
        netKwh: importKwh - exportKwh,
        previousGenerationRate: toNumber(record.Rate_GenSysCharge ?? row.Rate_GenSysCharge),
        netMeteringCredit,
        netMeteringExportCredit,
        previousMonthCredit: netMeteringPreviousCredit,
      } : {}),
      generationSubtotal: 0,
      transmissionSubtotal: 0,
      systemLossSubtotal: toNumber(row.SystemLossCharge),
      distributionSubtotal: 0,
      otherChargesTotal: 0,
      ancillarySubtotal: roundMoney(toNumber(row.AncillaryCharge)),
      vatSubtotal: toNumber(row.EVAT),
      lifelineDiscount: toNumber(row.LifelineDiscSubs),
      seniorDiscount: toNumber(row.senior_citizen_disc),
      totalBeforeDiscount: 0,
      totalBill: toNumber(row.TotalBill),
      flagSurcharge: isActiveFlag(row.flag_surcharge ?? record.flag_surcharge),
      surchargeAmount: isActiveFlag(row.flag_surcharge ?? record.flag_surcharge)
        ? Math.max(0, toNumber(row.surcharge_amount ?? record.surcharge_amount))
        : 0,
      latePaymentCharge: isActiveFlag(row.flag_surcharge ?? record.flag_surcharge)
        ? Math.max(0, toNumber(row.surcharge_amount ?? record.surcharge_amount))
        : 0,
      dueDate: record.Sched_DueDate,
      disconnectionDate: row.DiscoDate || record.Sched_DisconnectionDate,
      meterReaderName,
      officialReceiptNo,
      isPaid,
      paidAt: payment?.date_paid || row.date_paid || record.date_paid,
      arrearsBreakdown: record.balance_breakdown || '',
      arrearsTotal: toNumber(record.balance_previous || row.balance_previous),
    },
  };

  invoice.printableInvoice.generationSubtotal = invoice.generationSubtotal;
  invoice.printableInvoice.transmissionSubtotal = invoice.transmissionSubtotal;
  invoice.printableInvoice.distributionSubtotal = invoice.distributionSubtotal;
  invoice.printableInvoice.otherChargesTotal = invoice.otherChargesTotal;
  invoice.printableInvoice.ancillarySubtotal = invoice.ancillarySubtotal;
  invoice.printableInvoice.totalBeforeDiscount = invoice.totalBeforeDiscount;
  return invoice;
}

async function saveInvoice(db, readingRecord, invoice, options = {}) {
  await ensureInvoiceSchema(db);
  const existingPayment = await getReadingPayment(db, readingRecord, options);
  const existingBill = await getBillHistoryForReading(db, readingRecord, options);
  if (isReadingPaid(readingRecord, existingPayment, existingBill)) {
    throw new Error('This bill is already paid. Reading cannot be edited.');
  }

  const id = invoice.id || invoiceIdFor(readingRecord, invoice);
  const ts = nowIso();
  const printable = invoice.printableInvoice || {};

  await saveBillHistory(db, readingRecord, invoice, id);
  await saveBillHistoryArrears(db, readingRecord);

  await db.runAsync(
    INVOICE_UPSERT_SQL,
    buildInvoiceUpsertParams(id, readingRecord, invoice, printable, ts)
  );

  const key = readingRecord._rowid ? 'rowid' : 'code';
  const keyValue = readingRecord._rowid || readingRecord.code;
  const readingColumns = await tableColumns(db, 'reading');
  const demandUpdate = hasColumn(readingColumns, 'Demand') ? 'Demand = ?,' : '';
  await db.runAsync(
    `UPDATE reading SET
      Reading_KWH = ?,
      present_reading = ?,
      computed_kwh = ?,
      ${demandUpdate}
      total_bill = ?,
      lifeline_discount = ?,
      senior_discount = ?,
      net_metering_credit = ?,
      net_metering_previous_credit = ?,
      flag_surcharge = ?,
      surcharge_amount = ?,
      invoice_status = ?,
      is_synced = 0,
      flag_read = '1',
      tries_count = CASE WHEN COALESCE(tries_count, 0) < 2 THEN COALESCE(tries_count, 0) + 1 ELSE 2 END,
      updated_at = ?
     WHERE ${key} = ?`,
    [
      invoice.presentReading,
      invoice.presentReading,
      invoice.computedKwh,
      ...(demandUpdate ? [invoice.demandKwh || 0] : []),
      invoice.totalBill,
      invoice.lifelineDiscount,
      invoice.seniorDiscount,
      invoice.netMeteringCredit || 0,
      invoice.netMeteringPreviousCredit || 0,
      printable.flagSurcharge ? 1 : 0,
      printable.flagSurcharge ? Math.max(0, toNumber(printable.surchargeAmount)) : 0,
      'created',
      ts,
      keyValue,
    ]
  );

  return { ...invoice, id };
}

async function computeAndSaveInvoice(db, id, newPresentReading, options = {}) {
  const readingRecord = await getReadingRecord(db, id, options);
  if (!readingRecord) throw new Error('Reading record not found in local SQLite.');
  if (toNumber(readingRecord.tries_count) >= 2 && !options.allowAdminOverride) {
    throw new Error('Reading can only be attempted up to 2 times.');
  }
  const invoice = computeInvoice(readingRecord, newPresentReading, options);
  invoice.collectorCode = options.collectorCode || readingRecord.collector_code || '';
  if (invoice.warnings.length > 0 && !options.allowAdminOverride) {
    throw new Error(invoice.warnings[0]);
  }
  return saveInvoice(db, readingRecord, invoice, options);
}

async function computeAndSaveNetMeteringInvoice(db, id, netMeteringInput, options = {}) {
  const readingRecord = await getReadingRecord(db, id, options);
  if (!readingRecord) throw new Error('Reading record not found in local SQLite.');
  const summary = await getPaymentSummary(db, id, options);
  if (summary.isPaid) throw new Error('This bill is already paid. Reading cannot be edited.');
  if (toNumber(readingRecord.tries_count) >= 2 && !options.allowAdminOverride) {
    throw new Error('Reading can only be attempted up to 2 times.');
  }
  const previousMonthCredit =
    netMeteringInput.previousMonthCredit ??
    netMeteringInput.previousCredit ??
    netMeteringInput.previousNetMeteringCredit ??
    readingRecord.net_metering_previous_credit ??
    readingRecord.PreviousMonthCredit ??
    (await getPreviousNetMeteringCredit(db, readingRecord, options));
  const invoice = computeNetMeteringInvoice(readingRecord, { ...netMeteringInput, previousMonthCredit }, options);
  return saveInvoice(db, readingRecord, invoice, options);
}

async function savePayment(db, id, paymentInput = {}) {
  const summary = await getPaymentSummary(db, id, paymentInput);
  const { readingRecord, bill, arrears } = summary;
  if (summary.isPaid) throw new Error('This bill is already marked as paid.');

  const selectedBillMonths = Array.isArray(paymentInput.selectedArrearsBillMonths)
    ? paymentInput.selectedArrearsBillMonths.map((value) => String(value))
    : null;
  const payableArrears = selectedBillMonths
    ? arrears.filter((row) => selectedBillMonths.includes(String(row.BillMonth || row.billMonth || '')))
    : arrears;
  const payableArrearsTotal = roundMoney(
    payableArrears.reduce((sum, row) => sum + toNumber(row.TotalBill || row.balance_previous), 0) ||
      (!selectedBillMonths || (arrears.length === 0 && selectedBillMonths.length > 0) ? toNumber(summary.arrearsTotal) : 0)
  );
  const amountDue = roundMoney(
    paymentInput.amountDue != null ? toNumber(paymentInput.amountDue) : roundMoney(summary.billAmount + payableArrearsTotal)
  );
  const amountPaid = roundMoney(toNumber(paymentInput.amountPaid));
  if (!paymentInput.orNumber) throw new Error('Official Receipt number is required.');
  if (amountPaid < amountDue) throw new Error('Amount paid must cover the total bill.');

  const ts = paymentInput.datePaid || new Date().toLocaleString();
  const change = roundMoney(amountPaid - amountDue);
  const collectorCode = paymentInput.collectorCode || '';
  const billNumber = bill?.BillNumber || readingRecord.billno || invoiceIdFor(readingRecord, { netMetering: false });
  const arrearsTotal = payableArrearsTotal;

  const tables = modeTables(paymentInput);
  if (await tableExists(db, tables.pay)) {
    await insertMappedRow(db, tables.pay, {
      AccountNumber: readingRecord.AccountNumber,
      Name: readingRecord.Name,
      Code: firstValue(readingRecord, ['code', 'Code'], 0),
      Serial: readingRecord.Serial,
      TotalBill: amountDue,
      BillMonth: readingRecord.BillMonth,
      date_paid: ts,
      Read_Time: ts,
      collector_code: collectorCode,
      Area: readingRecord.Area,
      Book: readingRecord.Book,
      Sequence: readingRecord.Sequence,
      billnumber: billNumber,
      BillNumber: billNumber,
      ornumber: paymentInput.orNumber,
      tries_count: readingRecord.tries_count || 0,
      print_count: readingRecord.flag_printed || 0,
      flag_withprevious: readingRecord.flag_withprevious,
      balance_previous: arrearsTotal,
    });
  }

  if (await tableExists(db, tables.history)) {
    const code = firstValue(readingRecord, ['code', 'Code'], null);
    const columns = await tableColumns(db, tables.history);
    const whereClause = code != null && hasColumn(columns, 'Code') ? 'Code = ? AND BillMonth = ?' : 'AccountNumber = ? AND BillMonth = ?';
    const whereParams =
      code != null && hasColumn(columns, 'Code')
        ? [String(code), String(readingRecord.BillMonth)]
        : [String(readingRecord.AccountNumber), String(readingRecord.BillMonth)];
    await db.runAsync(
      `UPDATE billhistory SET
        flag_paid = 'Y',
        date_paid = ?,
        collector_code = ?,
        amt_tendered = ?,
        amt_change = ?,
        ornumber = ?
       WHERE ${whereClause}`.replace('billhistory', q(tables.history)),
      [
        ts,
        collectorCode,
        amountPaid,
        change,
        paymentInput.orNumber,
        ...whereParams,
      ]
    );
  }

  if ((await tableExists(db, tables.arrears)) && payableArrears.length > 0) {
    for (const row of payableArrears) {
      await db.runAsync(
        `UPDATE ${q(tables.arrears)} SET
          flag_paid = 'Y',
          date_paid = ?,
          collector_code = ?,
          amt_tendered = ?,
          amt_change = ?,
          ornumber = ?
         WHERE AccountNumber = ? AND BillMonth = ?`,
        [
          ts,
          collectorCode,
          amountPaid,
          change,
          paymentInput.orNumber,
          String(row.AccountNumber),
          String(row.BillMonth),
        ]
      );
    }
  }

  if (!isDiscoMode(paymentInput)) {
    const key = readingRecord._rowid ? 'rowid' : 'code';
    const keyValue = readingRecord._rowid || readingRecord.code;
    await db.runAsync(
      `UPDATE reading SET
        flag_paid = 1,
        ornumber = ?,
        date_paid = ?,
        paid_amount_total = ?,
        is_synced = 0,
        updated_at = ?
       WHERE ${key} = ?`,
      [paymentInput.orNumber, ts, amountPaid, new Date().toISOString(), keyValue]
    );
  }

  return {
    accountNumber: readingRecord.AccountNumber,
    name: readingRecord.Name,
    billMonth: readingRecord.BillMonth,
    billNumber,
    orNumber: paymentInput.orNumber,
    amountDue,
    amountPaid,
    change,
    datePaid: ts,
    collectorCode,
    arrearsPaid: arrearsTotal,
    paymentMethod: paymentInput.paymentMethod || 'cash',
  };
}

async function getInvoice(db, id) {
  await ensureInvoiceSchema(db);
  const row = await db.getFirstAsync('SELECT * FROM invoices WHERE id = ? LIMIT 1', [String(id)]);
  if (!row?.invoice_json) return row || null;
  try {
    return JSON.parse(row.invoice_json);
  } catch {
    return row;
  }
}

async function getLatestInvoiceForReading(db, id, options = {}) {
  const readingRecord = await getReadingRecord(db, id, options);
  if (!readingRecord) return null;
  const bill = await getBillHistoryForReading(db, readingRecord, options);
  if (bill) return billHistoryToInvoice(db, bill, readingRecord, options);
  const row = await db.getFirstAsync(
    'SELECT * FROM invoices WHERE accountnumber = ? ORDER BY updated_at DESC LIMIT 1',
    [String(readingRecord.AccountNumber)]
  );
  if (!row?.invoice_json) return row || null;
  try {
    return JSON.parse(row.invoice_json);
  } catch {
    return row;
  }
}

async function getPrintableInvoiceForReading(db, id, options = {}) {
  const readingRecord = await getReadingRecord(db, id, options);
  if (!readingRecord) return null;

  const bill = await getBillHistoryForReading(db, readingRecord, options);
  const arrears = await getArrearsRows(db, readingRecord, options);
  const payment = await getReadingPayment(db, readingRecord, options);
  const invoice = bill ? await billHistoryToInvoice(db, bill, readingRecord, options) : await getLatestInvoiceForReading(db, id, options);
  if (!invoice) return null;

  return {
    ...invoice,
    printSources: {
      reading: readingRecord,
      billhistory: bill || {},
      billhistory_arrears: arrears,
      payment: payment || null,
      readingBreakdown: parseArrearsBreakdown(readingRecord),
      rawReadingBreakdown: readingRecord.total_amount_breakdown || readingRecord.balance_breakdown || '',
      source: modeTables(options).source,
    },
  };
}

module.exports = {
  INVOICE_UPSERT_SQL,
  buildInvoiceUpsertParams,
  computeAndSaveInvoice,
  computeAndSaveNetMeteringInvoice,
  ensureInvoiceSchema,
  getInvoice,
  getLatestInvoiceForReading,
  getPrintableInvoiceForReading,
  getPaymentSummary,
  getReadingRecord,
  listReadingRecords,
  savePayment,
  saveInvoice,
};
