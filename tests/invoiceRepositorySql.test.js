const assert = require('assert');
const { INVOICE_UPSERT_SQL, buildInvoiceUpsertParams } = require('../database/invoiceRepository');

function splitTopLevel(text) {
  const values = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    if (text[index] === ')') depth -= 1;
    if (text[index] === ',' && depth === 0) {
      values.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(text.slice(start).trim());
  return values;
}

const match = INVOICE_UPSERT_SQL.match(/invoices\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*)\)\s*$/i);
assert(match, 'invoice upsert SQL should expose its column and VALUES lists');

const columns = splitTopLevel(match[1]);
const values = splitTopLevel(match[2]);
assert.strictEqual(columns.length, 28, 'invoice upsert should list 28 columns');
assert.strictEqual(values.length, 28, 'invoice upsert should provide one value expression per column');
assert.strictEqual(columns[25], 'invoice_json');
assert.strictEqual(values[25], '?', 'invoice_json should have its own placeholder before created_at');
assert.strictEqual((INVOICE_UPSERT_SQL.match(/\?/g) || []).length, 29, 'created_at COALESCE requires one extra bind');

const reading = {
  AccountNumber: 'TEST-ACCOUNT-001',
  BillMonth: '112026',
  Sched_DueDate: '2026-11-30',
  Sched_DisconnectionDate: '2026-12-05',
  flag_paid: 0,
};
const invoice = {
  previousReading: 100,
  presentReading: 125,
  multiplier: 1,
  computedKwh: 25,
  generationSubtotal: 50,
  transmissionSubtotal: 10,
  distributionSubtotal: 15,
  otherChargesTotal: 2,
  ancillarySubtotal: 1,
  vatSubtotal: 9,
  lifelineDiscount: 0,
  seniorDiscount: 0,
  netMeteringCredit: 0,
  totalBeforeDiscount: 87,
  totalBill: 87,
};
const printable = { officialReceiptNo: 'OR-1', flagSurcharge: true, surchargeAmount: 100 };
const params = buildInvoiceUpsertParams('invoice-1', reading, invoice, printable, '2026-11-18T00:00:00.000Z');
assert.strictEqual(params.length, 29, 'invoice upsert params should match all 29 bind placeholders');
assert.strictEqual(params[16], 1);
assert.strictEqual(params[17], 100);
assert.deepStrictEqual(JSON.parse(params[25]), { ...invoice, id: 'invoice-1' });
assert.strictEqual(params[26], 'invoice-1', 'created_at lookup should reuse invoice id');

console.log('invoiceRepository SQL tests passed');
