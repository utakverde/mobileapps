const assert = require('assert');
const { createInvoicePrintText } = require('../services/printerService');

const computed = createInvoicePrintText({
  printableInvoice: {
    accountNumber: 'TEST-ACCOUNT-001',
    totalBeforeDiscount: 20,
    totalBill: 21.06,
    arrearsTotal: 10,
    flagSurcharge: true,
    surchargeAmount: 100,
    latePaymentCharge: 100,
    dueDate: 'October 3, 2026',
    disconnectionDate: 'October 6, 2026',
  },
  breakdown: { otherCharges: [{ field: 'OCAmount1', rate: 0, amount: 3 }] },
});

assert.match(computed, /SUB TOTAL\s+20\.00/);
assert.match(computed, /TOTAL CURRENT BILL\s+Php 21\.06/);
assert.match(computed, /ARREARS\s+10\.00/);
assert.match(computed, /TOTAL AMOUNT DUE\s+Php 31\.06/);
assert.match(computed, /LATE PAYMENT CHARGE AFTER DUE DATE:\s+100\.00/);
assert.match(computed, /TOTAL AMOUNT AFTER DUE DATE\s+Php 131\.06/);
assert.match(computed, /DUE DATE \(Current billing\)\s+October 3, 2026/);
assert.match(computed, /DISCO DATE \(Current billing\)\s+October 6, 2026/);

const computedHeadings = [
  'Generation and Transmission Charges',
  'Generation Charges',
  'Transmission Charges',
  'Ancillary Charges',
  'Distribution Revenue',
  'Supply Charges',
  'Metering Charge',
  'Other Charges',
  'Government Charges',
  'Value Added Tax (VAT)',
  'Pass-Through Taxes',
  'Government Mandated Pass Through Charges',
  'Universal Charges',
];
let previousHeadingIndex = -1;
computedHeadings.forEach((heading) => {
  const headingIndex = computed.indexOf(heading, previousHeadingIndex + 1);
  assert.ok(headingIndex > previousHeadingIndex, `${heading} should appear in the new-format order`);
  previousHeadingIndex = headingIndex;
});
assert.doesNotMatch(computed, /Government Revenues/);
assert.match(computed, /Other Charge 1\s+0\.0000\s+3\.00/);

const sourced = createInvoicePrintText({
  printableInvoice: { accountNumber: 'TEST-ACCOUNT-002' },
  printSources: {
    reading: {
      Sched_DueDate: 'November 3, 2026',
      Sched_DisconnectionDate: 'November 6, 2026',
    },
    billhistory: { TotalBill: 50, OCCode1: 'Transformer Rental', OCAmount1: 2.5, flag_surcharge: 0, surcharge_amount: 100 },
    billhistory_arrears: [{ BillMonth: '0926', TotalBill: 5 }],
  },
});

assert.match(sourced, /TOTAL AMOUNT DUE\s+Php 55\.00/);
assert.match(sourced, /LATE PAYMENT CHARGE AFTER DUE DATE:/);
assert.match(sourced, /LATE PAYMENT CHARGE AFTER DUE DATE:\s+0\.00/);
assert.match(sourced, /TOTAL AMOUNT AFTER DUE DATE\s+Php 55\.00/);
assert.match(sourced, /November 3, 2026/);
assert.match(sourced, /November 6, 2026/);
assert.match(sourced, /SAGR Adjustment/);
assert.match(sourced, /NPC Stranded Debts/);
assert.match(sourced, /DUs Stranded Cost/);
assert.match(sourced, /Missionary Electrification NPC SPUG/);
assert.match(sourced, /Equalization of taxes and royalty/);
assert.match(sourced, /REC Rate/);
assert.match(sourced, /GEA-All/);
assert.match(sourced, /Transformer Rental\s+0\.0000\s+2\.50/);

console.log('Printer invoice summary tests passed.');
