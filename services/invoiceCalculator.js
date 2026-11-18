const {
  isActiveFlag,
  roundInternal,
  roundMoney,
  toNumber,
} = require('./discountCalculator');
const { computeNetMetering } = require('./netMeteringCalculator');
const { validateReadingInput } = require('./readingValidation');

const DEFAULT_INVOICE_CONFIG = {
  previousReadingField: 'Reading_KWH_Prev',
  presentReadingField: 'Reading_KWH',
  multiplierField: 'Multiplier',
  lifelineFlagField: 'flaglifeline',
  seniorFlagField: 'senior_citizen',
  lifelineDiscountRateField: 'Rate_LifelineDiscSubs',
  accountNumberField: 'AccountNumber',
  nameField: 'Name',
  addressField: 'Address',
  areaField: 'Area',
  bookField: 'Book',
  sequenceField: 'Sequence',
  serialField: 'Serial',
  billMonthField: 'BillMonth',
  rateCodeField: 'RateCode',
  dueDateField: 'Sched_DueDate',
  disconnectionDateField: 'Sched_DisconnectionDate',
  billNumberField: 'billno',
  officialReceiptField: 'ornumber',
  meterReaderField: 'MeterReader',
  generationRateFields: [
    'Rate_GenSysCharge',
    'Rate_HostCommCharge',
    'Rate_ForexCharge',
    'Rate_FPCA',
    'Rate_ICERA',
    'Rate_DAA8GRAM',
    'Rate_DAA7ICERA',
    'Rate_GenRefund',
    'RATE_GEA_ALL',
    'RATE_REX',
  ],
  transmissionRateFields: [
    'Rate_TCDemandCharge',
    'Rate_TCTransSystemCharge',
    'Rate_TransRefund',
  ],
  systemLossRateFields: ['Rate_SystemLossCharge', 'Rate_SysLossRefund'],
  distributionRateFields: [
    'Rate_DCDemandCharge',
    'Rate_DCDistributionCharge',
    'Rate_SCRetCustCharge',
    'Rate_SCSupplySysCharge',
    'Rate_MCRetailCustCharge',
    'Rate_MCSystemCharge',
    'Rate_MCC',
    'Rate_MCC_Substation',
    'Rate_LoanCondo',
    'Rate_LoanCondoRetail',
    'Rate_Fixed',
  ],
  distributionRevenueExclusionPatterns: [/MCC/i, /RFSC/i, /CAPEX/i, /REINVEST/i],
  universalRateFields: [
    'Rate_UCNPCStrandedDebts',
    'Rate_UCNPCStrandedContCost',
    'Rate_UCDUStrandedContCost',
    'Rate_UCME',
    'Rate_UCEqTaxesAndRoyalties',
    'Rate_UCEC',
    'Rate_UCCrossSubRemoval',
    'Rate_ICCrossSubsidyCharge',
    'Rate_PowerActRateRed',
    'Rate_FitAll',
    'Rate_LifelineCollect',
    'Rate_SeniorRefund',
    'Rate_RPPD',
    'Rate_ICCS',
    'Rate_Trueup',
    'Rate_UCME_Redci',
    'Rate_RealPropertyTax',
  ],
  vatRateFields: [
    'Vat_GenCharge',
    'Vat_SystemLoss',
    'Vat_Trans_Charge',
    'Vat_Dist_Charge',
    'Vat_Other',
    'EVAT_GenCharge',
    'EVAT_SystemLoss',
    'EVAT_Trans_Charge',
    'EVAT_Dist_Charge',
    'EVAT_OtherVat',
  ],
  ancillaryRateFields: ['Rate_AncillaryCharge', 'Rate_Ancillary'],
  ancillaryAmountFields: ['AncillaryCharge', 'AncillaryAmount'],
  ancillaryVatRateFields: ['Vat_Ancillary', 'EVAT_Ancillary'],
  otherAmountFields: [
    'OCAmount1',
    'OCAmount2',
    'OCAmount3',
    'OCAmount4',
    'OCAmount5',
    'OCAmount6',
    'OCAmount7',
    'OCAmount8',
    'OCAmount9',
    'OCAmount10',
  ],
  otherAmountPatterns: [/^OCAmount/i, /OtherCharges/i, /Surcharge/i],
  fixedAmountFields: ['Rate_MCRetailCustCharge', 'Rate_Fixed'],
  netMeteringCreditRateField: 'Rate_GenSysCharge',
};

function mergeConfig(config) {
  return { ...DEFAULT_INVOICE_CONFIG, ...(config || {}) };
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function resolveAmountFields(record, config) {
  const explicit = config.otherAmountFields || [];
  const patternMatches = Object.keys(record || {}).filter((key) =>
    (config.otherAmountPatterns || []).some((pattern) => pattern.test(key))
  );
  return unique([...explicit, ...patternMatches]);
}

function computeFieldBreakdown(record, fields, kwh, fixedAmountFields = []) {
  return unique(fields).map((field) => {
    const rate = toNumber(record[field]);
    const isFixed = fixedAmountFields.includes(field);
    const amount = roundInternal(isFixed ? rate : rate * kwh);
    return { field, rate, amount, isFixed };
  });
}

function getRate(record, field) {
  return toNumber(record[field]);
}

function amountItem(record, field, kwh, options = {}) {
  const rate = getRate(record, field);
  const amount = roundInternal(options.fixed ? rate : rate * kwh);
  return { field, rate, amount, isFixed: Boolean(options.fixed) };
}

function ancillaryItem(record, kwh, config) {
  const rateField = unique(config.ancillaryRateFields || []).find((field) => Number.isFinite(toNumber(record[field], NaN)));
  const amountField = unique(config.ancillaryAmountFields || []).find((field) => Number.isFinite(toNumber(record[field], NaN)));
  const rate = rateField ? getRate(record, rateField) : 0;
  const configuredAmount = amountField ? toNumber(record[amountField], NaN) : NaN;
  const hasConfiguredAmount = Number.isFinite(configuredAmount) && configuredAmount !== 0;
  return {
    field: 'AncillaryCharge',
    rate,
    amount: roundInternal(hasConfiguredAmount ? configuredAmount : rate * kwh),
    isFixed: hasConfiguredAmount,
  };
}

function getFlag(record, fields) {
  return fields.some((field) => isActiveFlag(record[field]));
}

function demandKwh(record, fallback = 0) {
  return toNumber(
    record.Demand ||
      record.DemandKWH ||
      record.DemandTrans ||
      record.demand_kwh ||
      record.demand,
    fallback
  );
}

function computeDesktopStyleBreakdown(record, kwh, multiplier, config, options = {}) {
  const rateCode = String(record[config.rateCodeField] || '').trim().toUpperCase();
  const explicitDemand = options.demandReading ?? options.overrideDemand ?? null;
  const sourceDemand = explicitDemand != null ? toNumber(explicitDemand) : demandKwh(record, 0);
  const demandBased = Boolean(options.largeLoadReading) || ['H', 'V'].includes(rateCode) || sourceDemand > 0;
  const demand = demandBased ? (sourceDemand > 0 ? sourceDemand : demandKwh(record, kwh)) : 0;
  const demandBase = demandBased ? demand * multiplier : kwh;

  const generation = [
    amountItem(record, 'Rate_GenSysCharge', kwh),
    amountItem(record, 'Rate_PowerActRateRed', kwh),
  ];
  const systemLoss = [amountItem(record, 'Rate_SystemLossCharge', kwh)];
  const generationRefunds = [];

  const transmission = [
    {
      field: 'Rate_TCDemandCharge',
      rate: getRate(record, 'Rate_TCDemandCharge'),
      amount: roundInternal(getRate(record, 'Rate_TCDemandCharge') * demandBase),
      isFixed: false,
    },
    amountItem(record, 'Rate_TCTransSystemCharge', kwh),
  ];

  const distribution = [
    {
      field: 'Rate_DCDemandCharge',
      rate: getRate(record, 'Rate_DCDemandCharge'),
      amount: roundInternal(getRate(record, 'Rate_DCDemandCharge') * demandBase),
      isFixed: false,
    },
    amountItem(record, 'Rate_DCDistributionCharge', kwh),
    amountItem(record, 'Rate_ICCrossSubsidyCharge', kwh),
    amountItem(record, 'Rate_LoanCondo', kwh),
    amountItem(record, 'Rate_LoanCondoRetail', 1),
    amountItem(record, 'Rate_MCRetailCustCharge', 1, { fixed: true }),
    amountItem(record, 'Rate_MCSystemCharge', kwh),
    amountItem(record, 'Rate_SCRetCustCharge', 1, { fixed: true }),
    amountItem(record, 'Rate_SCSupplySysCharge', kwh),
    amountItem(record, 'Rate_MCC', kwh),
    amountItem(record, 'Rate_MCC_Substation', kwh),
  ];

  const universal = [
    amountItem(record, 'Rate_UCCrossSubRemoval', kwh),
    amountItem(record, 'Rate_UCDUStrandedContCost', kwh),
    amountItem(record, 'Rate_UCEC', kwh),
    amountItem(record, 'Rate_UCEqTaxesAndRoyalties', kwh),
    amountItem(record, 'Rate_UCME', kwh),
    amountItem(record, 'Rate_UCNPCStrandedContCost', kwh),
    amountItem(record, 'Rate_UCNPCStrandedDebts', kwh),
    amountItem(record, 'Rate_FitAll', kwh),
  ];

  const otherCharges = resolveAmountFields(record, config).map((field) => ({
    field,
    rate: null,
    amount: roundInternal(toNumber(record[field])),
    isFixed: true,
  }));
  const ancillary = [ancillaryItem(record, kwh, config)];
  const occTotal = roundInternal(
    ['OCAmount1', 'OCAmount2', 'OCAmount3'].reduce((sum, field) => sum + toNumber(record[field]), 0)
  );

  const amountSubtotal =
    sumBreakdown(generation) +
    sumBreakdown(systemLoss) +
    sumBreakdown(generationRefunds) +
    sumBreakdown(transmission) +
    sumBreakdown(distribution) +
    sumBreakdown(universal) +
    sumBreakdown(ancillary) +
    occTotal;

  const vatGeneration = roundInternal(kwh * getRate(record, 'Vat_GenCharge'));
  const vatSystemLoss = roundInternal(kwh * getRate(record, 'Vat_SystemLoss'));
  const vatTransmission = roundInternal(kwh * getRate(record, 'Vat_Trans_Charge'));
  const vatDistributionRate = getRate(record, 'Vat_Dist_Charge');
  const vatOtherRate = getRate(record, 'Vat_Other');
  const distributionVatBase = ['Rate_DCDemandCharge', 'Rate_DCDistributionCharge', 'Rate_SCRetCustCharge', 'Rate_SCSupplySysCharge', 'Rate_MCRetailCustCharge', 'Rate_MCSystemCharge']
    .reduce((sum, field) => sum + sumBreakdown(distribution.filter((item) => item.field === field)), 0);
  const vatDistribution = roundInternal(distributionVatBase * vatDistributionRate);
  const vatOtherOcc = [1, 2, 3].reduce((sum, index) => {
    if (!isActiveFlag(record[`OCFlag${index}_Vat`])) return sum;
    return sum + toNumber(record[`OCAmount${index}`]) * vatOtherRate;
  }, 0);
  const ancillaryVatRate = (config.ancillaryVatRateFields || [])
    .map((field) => toNumber(record[field], NaN))
    .find((value) => Number.isFinite(value));
  const vatAncillary = Number.isFinite(ancillaryVatRate)
    ? roundInternal(ancillary[0].amount * ancillaryVatRate)
    : 0;
  const vat = [
    { field: 'EVAT_GenCharge', rate: getRate(record, 'Vat_GenCharge'), amount: vatGeneration, isFixed: false },
    { field: 'EVAT_SystemLoss', rate: getRate(record, 'Vat_SystemLoss'), amount: vatSystemLoss, isFixed: false },
    { field: 'EVAT_Trans_Charge', rate: getRate(record, 'Vat_Trans_Charge'), amount: vatTransmission, isFixed: false },
    { field: 'EVAT_Dist_Charge', rate: getRate(record, 'Vat_Dist_Charge'), amount: vatDistribution, isFixed: false },
    { field: 'EVAT_OtherVat', rate: getRate(record, 'Vat_Other'), amount: 0, isFixed: false },
    { field: 'EVAT_Ancillary', rate: ancillaryVatRate || 0, amount: vatAncillary, isFixed: false },
  ];

  let lifelineDiscount = 0;
  const lifelineFlag = getFlag(record, [config.lifelineFlagField, 'flag_lifeline', 'flaglifeline', 'flagLifeline']);
  if (['R', 'B'].includes(rateCode) && kwh <= 20) {
    const lifelineBase = roundInternal(
      (getRate(record, 'Rate_GenSysCharge') +
        getRate(record, 'Rate_SystemLossCharge') +
        getRate(record, 'Rate_TCDemandCharge') +
        getRate(record, 'Rate_TCTransSystemCharge') +
        getRate(record, 'Rate_DCDemandCharge') +
        getRate(record, 'Rate_DCDistributionCharge') +
        getRate(record, 'Rate_SCRetCustCharge') +
        getRate(record, 'Rate_SCSupplySysCharge') +
        getRate(record, 'Rate_MCSystemCharge')) *
        kwh +
        getRate(record, 'Rate_MCRetailCustCharge')
    );
    const lifelinePercent = kwh <= 15 ? 0.5 : kwh <= 16 ? 0.4 : kwh <= 17 ? 0.3 : kwh <= 18 ? 0.2 : kwh <= 19 ? 0.1 : 0.05;
    lifelineDiscount = -1 * roundInternal(lifelineBase * lifelinePercent);
  } else if (['R', 'B'].includes(rateCode) && kwh > 20) {
    lifelineDiscount = roundInternal(getRate(record, config.lifelineDiscountRateField) * kwh);
  } else if (!['R', 'B'].includes(rateCode)) {
    lifelineDiscount = roundInternal(getRate(record, config.lifelineDiscountRateField) * kwh);
  }

  vat[4].amount = roundInternal(vatOtherOcc + (kwh > 20 ? lifelineDiscount * vatOtherRate : 0));
  const vatSubtotal = sumBreakdown(vat);

  const seniorFlag = getFlag(record, [config.seniorFlagField, 'Senior', 'senior', 'senior_citizen']);
  let seniorDiscount = 0;
  const seniorBase =
    sumBreakdown(generation) +
    sumBreakdown(systemLoss) +
    sumBreakdown(transmission) +
    sumBreakdown(distribution.filter((item) => !/MCC|RFSC|CAPEX|REINVEST/i.test(item.field)));
  if (rateCode === 'R' && seniorFlag && kwh <= 100) {
    seniorDiscount = -1 * roundInternal((seniorBase + (lifelineFlag ? lifelineDiscount : 0)) * 0.05);
  } else if (rateCode === 'B' && seniorFlag) {
    seniorDiscount = roundInternal(toNumber(record.Bapa_senior_citizen_disc || record.bapa_senior_citizen_disc));
  }

  const totalBeforeDiscount = roundInternal(amountSubtotal + vatSubtotal);
  const totalBill = roundMoney(totalBeforeDiscount + lifelineDiscount + seniorDiscount);

  return {
    generation: [...generation, ...generationRefunds],
    transmission,
    systemLoss,
    distribution,
    universal,
    ancillary,
    vat,
    otherCharges,
    generationSubtotal: sumBreakdown([...generation, ...generationRefunds]),
    transmissionSubtotal: sumBreakdown(transmission),
    systemLossSubtotal: sumBreakdown(systemLoss),
    distributionSubtotal: sumBreakdown(distribution),
    distributionRevenueSubtotalWithoutRFSC: sumBreakdown(
      distribution.filter((item) => !/MCC|RFSC|CAPEX|REINVEST/i.test(item.field))
    ),
    universalSubtotal: sumBreakdown(universal),
    ancillarySubtotal: sumBreakdown(ancillary),
    vatSubtotal,
    otherChargesTotal: occTotal,
    lifelineDiscount,
    seniorDiscount,
    totalBeforeDiscount,
    totalBill,
    demandKwh: demand,
  };
}

function sumBreakdown(items) {
  return roundInternal(items.reduce((sum, item) => sum + toNumber(item.amount), 0));
}

function computeInvoice(readingRecord, newPresentReading, options = {}) {
  const config = mergeConfig(options.config);
  const previousReading = toNumber(readingRecord[config.previousReadingField]);
  const presentReading = toNumber(newPresentReading, toNumber(readingRecord[config.presentReadingField]));
  const multiplier = toNumber(readingRecord[config.multiplierField], 1) || 1;
  const readingValidation = options.overrideKwh != null
    ? {
        ok: true,
        message: '',
        computedKwh: toNumber(options.overrideKwh),
        billableKwh: Math.max(0, toNumber(options.overrideKwh)),
        rolloverApplied: false,
      }
    : validateReadingInput({
        previousReading,
        presentReading,
        multiplier,
        allowRollover: options.allowRollover,
        maxReading: options.maxReading,
        meterDigits: options.meterDigits,
      });
  const computedKwh = roundInternal(readingValidation.computedKwh ?? 0);

  const warnings = [];
  if (!readingValidation.ok) {
    warnings.push(readingValidation.message);
  }
  if (computedKwh < 0) {
    warnings.push('Computed kWh is negative.');
  }

  const billableKwh = Math.max(0, readingValidation.billableKwh ?? computedKwh);
  const largeLoadReading = options.mode === 'large_load' || options.largeLoadReading;
  const desktop = computeDesktopStyleBreakdown(readingRecord, billableKwh, multiplier, config, {
    demandReading: options.demandReading,
    largeLoadReading,
  });
  const {
    generation,
    transmission,
    systemLoss,
    distribution,
    universal,
    ancillary,
    vat,
    otherCharges,
    generationSubtotal,
    transmissionSubtotal,
    systemLossSubtotal,
    distributionSubtotal,
    distributionRevenueSubtotalWithoutRFSC,
    universalSubtotal,
    ancillarySubtotal,
    vatSubtotal,
    otherChargesTotal,
    lifelineDiscount,
    seniorDiscount,
    totalBeforeDiscount,
    totalBill,
  } = desktop;
  const lifelineEligible = lifelineDiscount < 0;
  const seniorEligible = seniorDiscount < 0;
  const referenceNumber =
    readingRecord[config.billNumberField] ||
    `${readingRecord[config.accountNumberField] || 'INV'}-${readingRecord[config.billMonthField] || Date.now()}`;
  const flagSurcharge = isActiveFlag(readingRecord.flag_surcharge);
  const surchargeAmount = flagSurcharge ? Math.max(0, toNumber(readingRecord.surcharge_amount)) : 0;

  return {
    computedKwh,
    billableKwh,
    previousReading,
    presentReading,
    multiplier,
    demandKwh: desktop.demandKwh,
    generationSubtotal,
    transmissionSubtotal,
    systemLossSubtotal,
    distributionSubtotal,
    distributionRevenueSubtotalWithoutRFSC,
    otherChargesTotal,
    universalSubtotal,
    ancillarySubtotal,
    vatSubtotal,
    discounts: {
      lifelineDiscount,
      seniorDiscount,
      lifelineEligible,
      seniorEligible,
    },
    lifelineDiscount,
    seniorDiscount,
    totalBeforeDiscount,
    totalBill,
    flagSurcharge,
    surchargeAmount,
    warnings,
    readingValidation,
    breakdown: {
      generation,
      transmission,
      systemLoss,
      distribution,
      universal,
      ancillary,
      vat,
      otherCharges,
    },
    printableInvoice: {
      referenceNumber,
      accountNumber: readingRecord[config.accountNumberField],
      consumerName: readingRecord[config.nameField],
      address: readingRecord[config.addressField],
      area: readingRecord[config.areaField],
      book: readingRecord[config.bookField],
      sequence: readingRecord[config.sequenceField],
      serialNumber: readingRecord[config.serialField],
      billMonth: readingRecord[config.billMonthField],
      rateCode: readingRecord[config.rateCodeField],
      previousReading,
      presentReading,
      previousReadingDate: readingRecord.Sched_PrevRdngDate || '',
      presentReadingDate: readingRecord.Sched_PresRdngDate || '',
      multiplier,
      demandKwh: desktop.demandKwh,
      computedKwh,
      generationSubtotal,
      transmissionSubtotal,
      systemLossSubtotal,
      distributionSubtotal,
      otherChargesTotal,
      ancillarySubtotal,
      vatSubtotal,
      lifelineDiscount,
      seniorDiscount,
      totalBeforeDiscount,
      totalBill,
      flagSurcharge,
      surchargeAmount,
      latePaymentCharge: surchargeAmount,
      dueDate: readingRecord[config.dueDateField],
      disconnectionDate: readingRecord[config.disconnectionDateField],
      meterReaderName: readingRecord[config.meterReaderField] || '',
      officialReceiptNo: readingRecord[config.officialReceiptField] || '',
      isLifeline: lifelineEligible || getFlag(readingRecord, [config.lifelineFlagField, 'flag_lifeline', 'flaglifeline', 'flagLifeline']),
      isSenior: seniorEligible || getFlag(readingRecord, [config.seniorFlagField, 'Senior', 'senior', 'senior_citizen']),
      arrearsBreakdown: readingRecord.balance_breakdown || '',
      arrearsTotal: toNumber(readingRecord.balance_previous),
      isPaid: isActiveFlag(readingRecord.flag_paid),
      paidAt: readingRecord.date_paid || '',
    },
  };
}

function computeNetMeteringInvoice(readingRecord, netMeteringInput, options = {}) {
  const config = mergeConfig(options.config);
  const net = computeNetMetering(netMeteringInput);
  const creditRate = toNumber(readingRecord[config.netMeteringCreditRateField]);
  const exportGenerationCredit = -1 * roundInternal(net.exportKwh * creditRate);
  const previousMonthCredit = net.previousMonthCredit;
  const credit = roundInternal(exportGenerationCredit + previousMonthCredit);
  const invoice = computeInvoice(readingRecord, net.importKwh, {
    ...options,
    overrideKwh: Math.max(0, net.importKwh),
    allowAdminOverride: true,
  });
  const totalBill = roundMoney(invoice.totalBill + credit);
  const warnings = [...(invoice.warnings || []), ...(net.warnings || [])];

  return {
    ...invoice,
    warnings,
    computedKwh: net.importKwh,
    billableKwh: Math.max(0, net.importKwh),
    netMetering: {
      ...net,
      credit,
      exportGenerationCredit,
      previousMonthCredit,
    },
    netMeteringCredit: credit,
    netMeteringExportCredit: exportGenerationCredit,
    netMeteringPreviousCredit: previousMonthCredit,
    totalBill,
    printableInvoice: {
      ...invoice.printableInvoice,
      computedKwh: net.importKwh,
      importKwh: net.importKwh,
      exportKwh: net.exportKwh,
      netKwh: net.netKwh,
      netMeteringCredit: credit,
      netMeteringExportCredit: exportGenerationCredit,
      previousMonthCredit,
      totalBill,
    },
  };
}

module.exports = {
  DEFAULT_INVOICE_CONFIG,
  computeInvoice,
  computeNetMeteringInvoice,
  computeFieldBreakdown,
  sumBreakdown,
};
