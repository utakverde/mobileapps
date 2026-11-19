const assert = require('node:assert/strict');
const test = require('node:test');
const { computeInvoice, computeNetMeteringInvoice } = require('../services/invoiceCalculator');
const { isDesktopWrapAroundCandidate, validateReadingInput } = require('../services/readingValidation');

function baseRecord(overrides = {}) {
  return {
    AccountNumber: 'A-001',
    Name: 'Test Consumer',
    Address: 'Test Address',
    Area: '01',
    Book: '02',
    Sequence: '0001',
    Serial: 'MTR-1',
    BillMonth: '0526',
    RateCode: 'R',
    Reading_KWH_Prev: 1000,
    Multiplier: 1,
    Rate_GenSysCharge: 6,
    Rate_TCTransSystemCharge: 2,
    Rate_DCDistributionCharge: 3,
    Rate_MCC: 10,
    Rate_MCC_Substation: 5,
    Rate_LifelineDiscSubs: 0.2,
    Vat_GenCharge: 0,
    Vat_SystemLoss: 0,
    Vat_Trans_Charge: 0,
    Vat_Dist_Charge: 0,
    Vat_Other: 0,
    OCAmount1: 0,
    OCAmount2: 0,
    OCAmount3: 0,
    flaglifeline: 0,
    senior_citizen: 0,
    ...overrides,
  };
}

test('normal residential consumer includes desktop lifeline collection', () => {
  const invoice = computeInvoice(baseRecord(), 1120);
  assert.equal(invoice.computedKwh, 120);
  assert.equal(invoice.lifelineDiscount, 24);
  assert.equal(invoice.seniorDiscount, 0);
});

test('database surcharge flag gates the after-due charge without changing current bill', () => {
  const disabled = computeInvoice(baseRecord({ flag_surcharge: 0, surcharge_amount: 100 }), 1120);
  const enabled = computeInvoice(baseRecord({ flag_surcharge: 1, surcharge_amount: 100 }), 1120);

  assert.equal(disabled.surchargeAmount, 0);
  assert.equal(disabled.printableInvoice.latePaymentCharge, 0);
  assert.equal(enabled.surchargeAmount, 100);
  assert.equal(enabled.printableInvoice.latePaymentCharge, 100);
  assert.equal(enabled.totalBill, disabled.totalBill);
});

test('canonical disconnection date takes precedence over the legacy scheduled date', () => {
  const invoice = computeInvoice(
    baseRecord({
      disconnection_date: '2026-12-10',
      Sched_DisconnectionDate: '2026-12-09',
    }),
    1120
  );

  assert.equal(invoice.printableInvoice.disconnectionDate, '2026-12-10');
});

test('ancillary rate is calculated per billable kWh and included in the bill subtotal', () => {
  const invoice = computeInvoice(baseRecord({ Rate_Ancillary: 1.5 }), 1120);
  assert.equal(invoice.ancillarySubtotal, 180);
  assert.equal(invoice.breakdown.ancillary[0].field, 'AncillaryCharge');
  assert.equal(invoice.breakdown.ancillary[0].rate, 1.5);
  assert.equal(invoice.breakdown.ancillary[0].amount, 180);
  assert.equal(invoice.totalBill, 3324);
});

test('fixed ancillary amount overrides the rate when supplied', () => {
  const invoice = computeInvoice(baseRecord({ Rate_Ancillary: 1.5, AncillaryAmount: 25 }), 1120);
  assert.equal(invoice.ancillarySubtotal, 25);
  assert.equal(invoice.breakdown.ancillary[0].isFixed, true);
});

test('lifeline senior consumer follows desktop percentage lifeline adjustment', () => {
  const invoice = computeInvoice(baseRecord({ flaglifeline: 1, senior_citizen: 1 }), 1020);
  assert.equal(invoice.computedKwh, 20);
  assert.equal(invoice.discounts.lifelineEligible, true);
  assert.equal(invoice.lifelineDiscount, -11);
  assert.equal(invoice.seniorDiscount, -10.45);
});

test('senior consumer gets 5 percent of gen + trans + distribution excluding RFSC/CAPEX/MCC', () => {
  const invoice = computeInvoice(baseRecord({ senior_citizen: 1 }), 1080);
  assert.equal(invoice.computedKwh, 80);
  assert.equal(invoice.discounts.seniorEligible, true);
  assert.equal(invoice.distributionRevenueSubtotalWithoutRFSC, 240);
  assert.equal(invoice.seniorDiscount, -44);
});

test('lifeline and senior above 20 kWh uses desktop per-kWh lifeline and senior offset rule', () => {
  const invoice = computeInvoice(baseRecord({ flaglifeline: 1, senior_citizen: 1 }), 1045);
  assert.equal(invoice.computedKwh, 45);
  assert.equal(invoice.lifelineDiscount, 9);
  assert.equal(invoice.seniorDiscount, -25.2);
});

test('senior above 100 kWh gets no senior discount', () => {
  const invoice = computeInvoice(baseRecord({ senior_citizen: 1 }), 1120);
  assert.equal(invoice.computedKwh, 120);
  assert.equal(invoice.seniorDiscount, 0);
});

test('lifeline above 50 kWh uses desktop per-kWh lifeline amount', () => {
  const invoice = computeInvoice(baseRecord({ flaglifeline: 1 }), 1060);
  assert.equal(invoice.computedKwh, 60);
  assert.equal(invoice.lifelineDiscount, 12);
});

test('desktop flagLifeline column is recognized as lifeline eligibility', () => {
  const invoice = computeInvoice(baseRecord({ flaglifeline: 0, flagLifeline: 1 }), 1020);
  assert.equal(invoice.computedKwh, 20);
  assert.equal(invoice.discounts.lifelineEligible, true);
  assert.equal(invoice.printableInvoice.isLifeline, true);
  assert.equal(invoice.lifelineDiscount, -11);
});

test('net metering bills incoming kWh and credits outgoing generation', () => {
  const invoice = computeNetMeteringInvoice(
    baseRecord(),
    {
      importPrevious: 1000,
      importPresent: 1300,
      exportPrevious: 500,
      exportPresent: 600,
      importMultiplier: 1,
      exportMultiplier: 1,
    }
  );
  assert.equal(invoice.netMetering.importKwh, 300);
  assert.equal(invoice.netMetering.exportKwh, 100);
  assert.equal(invoice.netMetering.netKwh, 200);
  assert.equal(invoice.computedKwh, 300);
  assert.equal(invoice.billableKwh, 300);
  assert.equal(invoice.netMetering.exportGenerationCredit, -600);
});

test('net metering carries previous negative bill as previous month credit', () => {
  const invoice = computeNetMeteringInvoice(
    baseRecord(),
    {
      importPrevious: 1000,
      importPresent: 1100,
      exportPrevious: 500,
      exportPresent: 700,
      importMultiplier: 1,
      exportMultiplier: 1,
      previousMonthCredit: -3000,
    }
  );
  assert.equal(invoice.netMetering.previousMonthCredit, -3000);
  assert.equal(invoice.netMetering.exportGenerationCredit, -1200);
  assert.equal(invoice.netMeteringCredit, -4200);
  assert.equal(invoice.totalBill < 0, true);
});

test('net metering treats positive previous credit input as a negative credit', () => {
  const invoice = computeNetMeteringInvoice(
    baseRecord(),
    {
      importPrevious: 1000,
      importPresent: 1100,
      exportPrevious: 500,
      exportPresent: 500,
      previousMonthCredit: 250,
    }
  );
  assert.equal(invoice.netMetering.previousMonthCredit, -250);
});

test('large load reading uses demand reading times multiplier for demand charges', () => {
  const invoice = computeInvoice(
    baseRecord({
      RateCode: 'H',
      Reading_KWH_Prev: 1000,
      Multiplier: 5,
      Rate_TCDemandCharge: 10,
      Rate_DCDemandCharge: 20,
      Rate_TCTransSystemCharge: 0,
      Rate_DCDistributionCharge: 0,
      Rate_GenSysCharge: 0,
      Rate_MCC: 0,
      Rate_MCC_Substation: 0,
      Rate_LifelineDiscSubs: 0,
    }),
    1100,
    { mode: 'large_load', demandReading: 12 }
  );

  assert.equal(invoice.computedKwh, 500);
  assert.equal(invoice.demandKwh, 12);
  assert.equal(invoice.transmissionSubtotal, 600);
  assert.equal(invoice.distributionSubtotal, 1200);
  assert.equal(invoice.printableInvoice.demandKwh, 12);
});

test('wrong lower present reading is trapped before billing', () => {
  const validation = validateReadingInput({
    previousReading: 7318,
    presentReading: 7000,
    multiplier: 1,
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.computedKwh, -318);

  const invoice = computeInvoice(baseRecord({ Reading_KWH_Prev: 7318 }), 7000);
  assert.equal(invoice.warnings.length > 0, true);
  assert.equal(invoice.totalBill >= 0, true);
});

test('meter rollover can be computed only when explicitly allowed', () => {
  const validation = validateReadingInput({
    previousReading: 9998,
    presentReading: 3,
    multiplier: 1,
    allowRollover: true,
    meterDigits: 4,
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.rolloverApplied, true);
  assert.equal(validation.computedKwh, 5);
});

test('meter rollover follows desktop wrap-around candidate ranges', () => {
  assert.equal(isDesktopWrapAroundCandidate(7318), true);
  assert.equal(isDesktopWrapAroundCandidate(500), false);

  const accepted = validateReadingInput({
    previousReading: 7318,
    presentReading: 3,
    multiplier: 1,
    allowRollover: true,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.computedKwh, 2685);

  const rejected = validateReadingInput({
    previousReading: 500,
    presentReading: 3,
    multiplier: 1,
    allowRollover: true,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.rolloverApplied, false);
});
