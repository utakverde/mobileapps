function money(value) {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRate(value) {
  const parsed = Number(value || 0);
  return parsed.toLocaleString('en-PH', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

function roundInternal(value) {
  return Math.round((num(value) + Number.EPSILON) * 100000000) / 100000000;
}

function firstValue(record, fields, fallback = '') {
  for (const field of fields) {
    if (record?.[field] != null && record[field] !== '') return record[field];
  }
  return fallback;
}

const PRINT_WIDTH = 48;
const SEP = '-'.repeat(PRINT_WIDTH);
const DOUBLE_SEP = '='.repeat(PRINT_WIDTH);
const EMPHASIS_ON = '\x1bE\x01';
const EMPHASIS_OFF = '\x1bE\x00';
const DOUBLE_OFF = '\x1b!\x00';
const LARGE_BOLD_ON = '\x1b!\x18';

function line(label, value, width = PRINT_WIDTH) {
  const left = String(label).slice(0, 22).padEnd(22, ' ');
  const right = String(value ?? '').slice(0, width - 22);
  return `${left}${right}`;
}

function noticeLine(label, value) {
  const left = String(label).slice(0, 18).padEnd(18, ' ');
  const right = String(value ?? '').slice(0, 21);
  return `${left} ${right}`;
}

function twoCol(label, value, width = PRINT_WIDTH) {
  const left = String(label).slice(0, 16);
  const right = String(value ?? '').slice(0, width - 17);
  return `${left.padEnd(width - right.length, ' ')}${right}`;
}

function flexibleCol(label, value, width = PRINT_WIDTH) {
  const right = String(value ?? '');
  const available = Math.max(0, width - right.length - 1);
  const left = String(label).slice(0, available);
  return `${left.padEnd(width - right.length, ' ')}${right}`;
}

function center(value, width = PRINT_WIDTH) {
  const text = String(value ?? '').slice(0, width);
  return text.padStart(Math.floor((width + text.length) / 2), ' ');
}

function printerLogoCommand() {
  return '\x1ba\x01\x1cp\x01\x00\x1ba\x00';
}

function boldText(value) {
  return `${EMPHASIS_ON}${value}${EMPHASIS_OFF}`;
}

function largeBoldText(value) {
  return `${LARGE_BOLD_ON}${value}${DOUBLE_OFF}`;
}

function headerRows() {
  return [
    printerLogoCommand(),
    largeBoldText(center('SAMAR II ELECTRIC COOPERATIVE, INC.')),
    center('PARANAS, SAMAR'),
  ];
}

function qrDataCommand(data) {
  const text = String(data || '').trim();
  if (!text) return '';
  const length = text.length + 3;
  const pL = length % 256;
  const pH = Math.floor(length / 256);
  return [
    '\x1d(k\x04\x001A2\x00',
    '\x1d(k\x03\x001C\x05',
    '\x1d(k\x03\x001E0',
    '\x1ba\x01',
    `\x1d(k${String.fromCharCode(pL)}${String.fromCharCode(pH)}1P0${text}`,
    '\x1d(k\x03\x001Q0',
    '\x1ba\x00',
  ].join('');
}

function shortDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    const hh = String(parsed.getHours()).padStart(2, '0');
    const min = String(parsed.getMinutes()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
  }
  return raw.replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 16);
}

function formatBillMonth(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{2})(\d{2})$/);
  if (!match) return raw;
  const monthIndex = Number(match[1]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return raw;
  const year = 2000 + Number(match[2]);
  const month = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' });
  return `${month} ${year}`;
}

function wrapText(text, width = PRINT_WIDTH) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const rows = [];
  let row = '';
  words.forEach((word) => {
    if (!row) {
      row = word;
    } else if (`${row} ${word}`.length <= width) {
      row = `${row} ${word}`;
    } else {
      rows.push(row);
      row = word;
    }
  });
  if (row) rows.push(row);
  return rows.length ? rows : [''];
}

function rateAmountLine(label, rate, amount) {
  const name = String(label).slice(0, 23).padEnd(23, ' ');
  const rateText = formatRate(rate).slice(0, 7).padStart(7, ' ');
  const amountText = money(amount).slice(0, 9).padStart(9, ' ');
  return `${name}${rateText}${amountText}`;
}

function sourceAmount(bill, fields) {
  return num(firstValue(bill, fields, 0));
}

function chargeBaseFor(rateField, reading, bill) {
  const kwh = num(
    bill.KilowattHour ??
      bill.KilowattUsed ??
      bill.Diff ??
      reading.KilowattHour ??
      reading.KilowattUsed ??
      reading.computed_kwh ??
      reading.Diff
  );
  const multiplier = num(bill.Multiplier ?? reading.Multiplier) || 1;
  const demand = num(bill.Demand ?? reading.Demand ?? reading.DemandKWH ?? reading.demand_kwh);
  const rateCode = String(bill.RateCode ?? reading.RateCode ?? '').trim().toUpperCase();
  const field = String(rateField || '');

  if (/Rate_(MC)?RetailCustCharge|Rate_SCRetCustCharge|Rate_LoanCondoRetail|Rate_Fixed/i.test(field)) return 1;
  if (/Rate_RPPD/i.test(field)) return ['R', 'B'].includes(rateCode) ? kwh : 1;
  if (/Rate_(TC|DC)DemandCharge/i.test(field)) return demand > 0 ? demand * multiplier : kwh;
  return kwh;
}

function computedChargeAmount(reading, bill, rateFields, amountFields, fallbackAmount = 0) {
  const savedAmount = sourceAmount(bill, amountFields);
  if (savedAmount !== 0) return savedAmount;

  const rateField = rateFields.find((field) => num(reading?.[field] ?? bill?.[field]) !== 0);
  const rate = num(reading?.[rateField] ?? bill?.[rateField]);
  if (rate !== 0) return roundInternal(rate * chargeBaseFor(rateField, reading, bill));

  return num(fallbackAmount);
}

function sourceItem(label, reading, bill, rateFields, amountFields, fallbackAmount = 0) {
  const rate = num(firstValue(reading, rateFields, firstValue(bill, rateFields, 0)));
  return {
    label,
    rate,
    amount: computedChargeAmount(reading, bill, rateFields, amountFields, fallbackAmount),
  };
}

function groupedSourceSection(title, groups) {
  const rows = [boldText(title), 'Rate Components            Rate   Amount'];
  groups.forEach((group) => {
    if (group.title) rows.push(boldText(`  ${group.title}`));
    group.items.forEach((item) => {
      const label = `  ${item.label}`;
      if (label.length <= 23) {
        rows.push(rateAmountLine(label, item.rate, item.amount));
      } else {
        rows.push(...wrapText(label, PRINT_WIDTH));
        rows.push(rateAmountLine('', item.rate, item.amount));
      }
    });
  });
  rows.push(SEP);
  return rows;
}

function computedBreakdownItem(invoice, label, fields) {
  const item = Object.values(invoice.breakdown || {})
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .find((candidate) => fields.includes(candidate.field));
  return { label, rate: num(item?.rate), amount: num(item?.amount) };
}

function newFormatGroups(item) {
  return [
    {
      title: 'Generation and Transmission Charges',
      groups: [
        { title: 'Generation Charges', items: [
          item('Generation Charge', ['Rate_GenSysCharge'], ['GenSysCharge']),
          item('Power Act Reduction', ['Rate_PowerActRateRed'], ['PowerActRateRed']),
          item('SAGR Adjustment', ['Rate_SAGRAdjustment', 'Rate_SAGR'], ['SAGRAdjustment', 'SAGR']),
        ] },
        { title: 'Transmission Charges', items: [
          item('Transmission System Charge', ['Rate_TCTransSystemCharge'], ['TCTransSystemCharge']),
          item('Transmission Demand Charge', ['Rate_TCDemandCharge'], ['TCDemandCharge']),
        ] },
        { title: 'Ancillary Charges', items: [
          item('Ancillary Charge', ['Rate_AncillaryCharge', 'Rate_Ancillary'], ['AncillaryCharge']),
          item('Ancillary Demand', ['Rate_AncillaryDemandCharge'], ['AncillaryDemandCharge']),
        ] },
      ],
    },
    {
      title: 'Distribution Revenue',
      groups: [
        { title: 'Distribution Revenue', items: [
          item('Distribution System', ['Rate_DCDistributionCharge'], ['DCDistributionCharge']),
          item('Distribution Demand', ['Rate_DCDemandCharge'], ['DCDemandCharge']),
        ] },
        { title: 'Supply Charges', items: [
          item('Fixed Supply Charge', ['Rate_SCRetCustCharge'], ['SCRetCustCharge']),
          item('Supply System Charge', ['Rate_SCSupplySysCharge'], ['SCSupplySysCharge']),
        ] },
        { title: 'Metering Charge', items: [
          item('Fixed Metering Charge', ['Rate_MCRetailCustCharge'], ['MCRetailCustCharge']),
          item('Metering Charge', ['Rate_MCSystemCharge'], ['MCSystemCharge']),
        ] },
      ],
    },
    {
      title: 'Other Charges',
      groups: [{ items: [
        item('RFSC', ['Rate_MCC'], ['MCC']),
        item('Other MCC', ['Rate_MCC_Substation'], ['MCC_Substation']),
      ] }],
    },
    {
      title: 'Government Charges',
      groups: [
        { title: 'Value Added Tax (VAT)', items: [
          item('Generation', ['Vat_GenCharge'], ['EVAT_GenCharge', 'Vat_GenCharge']),
          item('Power Act Reduction', ['Vat_PowerActRateRed'], ['EVAT_PowerActRateRed']),
          item('Transmission', ['Vat_Trans_Charge'], ['EVAT_Trans_Charge', 'Vat_Trans_Charge']),
          item('Ancillary Service', ['Vat_Ancillary'], ['EVAT_Ancillary']),
          item('Distribution', ['Vat_Dist_Charge'], ['EVAT_Dist_Charge', 'Vat_Dist_Charge']),
          item('Others', ['Vat_Other'], ['EVAT_OtherVat', 'Vat_Other']),
        ] },
        { title: 'Pass-Through Taxes', items: [
          item('Energy Tax', ['Rate_EnergyTax'], ['EnergyTax']),
          item('Real Property Tax', ['Rate_RealPropertyTax'], ['RealPropertyTax']),
          item('Business Tax', ['Rate_BusinessTax'], ['BusinessTax']),
          item('Local Franchise Tax', ['Rate_FranchiseTax'], ['FranchiseTax']),
        ] },
      ],
    },
    {
      title: 'Government Mandated Pass Through Charges',
      groups: [
        { items: [
          item('Allowable System Loss', ['Rate_SystemLossCharge'], ['SystemLossCharge']),
          item('Lifeline Rate Subsidy/Discount', ['Rate_LifelineDiscSubs', 'Rate_LifelineCollect'], ['LifelineDiscSubs', 'LifelineCollect']),
          item('Senior Citizen Subsidy/Discount', ['Rate_SeniorSubsidy', 'senior_citizen'], ['senior_citizen_subsidy', 'senior_citizen_disc']),
        ] },
        { title: 'Universal Charges', items: [
          item('NPC Stranded Debts', ['Rate_UCNPCStrandedDebts'], ['UCNPCStrandedDebts']),
          item('NPC Stranded Cost', ['Rate_UCNPCStrandedContCost'], ['UCNPCStrandedContCost']),
          item('DUs Stranded Cost', ['Rate_UCDUStrandedContCost'], ['UCDUStrandedContCost']),
          item('Missionary Electrification NPC SPUG', ['Rate_UCME'], ['UCME']),
          item('Missionary Electrification - REDCI', ['Rate_UCME_Redci'], ['UCME_Redci']),
          item('Environmental Charges', ['Rate_UCEC'], ['UCEC']),
          item('Equalization of taxes and royalty', ['Rate_UCEqTaxesAndRoyalties'], ['UCEqTaxesAndRoyalties']),
        ] },
        { items: [
          item('FIT-All', ['Rate_FitAll'], ['FitAll']),
          item('REC Rate', ['RATE_REX', 'Rate_REX'], ['REX']),
          item('GEA-All', ['RATE_GEA_ALL', 'Rate_GEA_ALL'], ['GEA_ALL']),
        ] },
      ],
    },
  ];
}

function newFormatActualRows(reading, bill) {
  const groups = newFormatGroups((label, rateFields, amountFields) => {
    if (label === 'Lifeline Rate Subsidy/Discount' || label === 'Senior Citizen Subsidy/Discount') {
      return {
        label,
        rate: 0,
        amount: amountFields.reduce((sum, field) => sum + sourceAmount(bill, [field]), 0),
      };
    }
    return sourceItem(label, reading, bill, rateFields, amountFields);
  });
  const otherSection = groups.find((section) => section.title === 'Other Charges');
  Array.from({ length: 10 }, (_, index) => index + 1).forEach((number) => {
    const amount = sourceAmount(bill, [`OCAmount${number}`, `OCTotal${number}`]);
    if (amount === 0) return;
    const label = firstValue(reading, [`OCCode${number}`], firstValue(bill, [`OCCode${number}`], `Other Charge ${number}`));
    otherSection.groups[0].items.push({
      label: String(label || `Other Charge ${number}`),
      rate: num(firstValue(reading, [`OCRate${number}`, `Rate_OC${number}`], firstValue(bill, [`OCRate${number}`, `Rate_OC${number}`], 0))),
      amount,
    });
  });
  return groups.flatMap((section) => groupedSourceSection(section.title, section.groups));
}

function newFormatComputedRows(invoice) {
  const p = invoice.printableInvoice || invoice;
  const groups = newFormatGroups((label, rateFields, amountFields) => {
    if (label === 'Lifeline Rate Subsidy/Discount') {
      return { label, rate: 0, amount: num(p.lifelineDiscount) };
    }
    if (label === 'Senior Citizen Subsidy/Discount') {
      return { label, rate: 0, amount: num(p.seniorDiscount) };
    }
    return computedBreakdownItem(invoice, label, [...rateFields, ...amountFields]);
  });
  const otherSection = groups.find((section) => section.title === 'Other Charges');
  (invoice.breakdown?.otherCharges || []).forEach((charge, index) => {
    if (num(charge.amount) === 0) return;
    otherSection.groups[0].items.push({
      label: charge.label || labelForOtherCharge(charge.field, index),
      rate: num(charge.rate),
      amount: num(charge.amount),
    });
  });
  return groups.flatMap((section) => groupedSourceSection(section.title, section.groups));
}

function labelForOtherCharge(field, index) {
  const match = String(field || '').match(/(\d+)$/);
  return `Other Charge ${match?.[1] || index + 1}`;
}

function arrearsRows(invoice) {
  const sources = invoice.printSources || {};
  const fromArrears = (sources.billhistory_arrears || []).map((row) => ({
    billMonth: row.BillMonth || row.billmonth,
    amount: num(row.TotalBill || row.balance_previous),
  }));
  if (fromArrears.length > 0) return fromArrears;
  return sources.readingBreakdown || [];
}

function invoiceSummaryValues(invoice) {
  const p = invoice.printableInvoice || invoice;
  const bill = invoice.printSources?.billhistory || {};
  const reading = invoice.printSources?.reading || {};
  const currentBill = num(bill.TotalBill ?? p.totalBill);
  const subTotal = num(p.totalBeforeDiscount ?? bill.TotalBeforeDiscount ?? currentBill);
  const arrears = arrearsRows(invoice);
  const arrearsTotal = roundMoney(
    arrears.length > 0
      ? arrears.reduce((sum, row) => sum + num(row.amount), 0)
      : num(p.arrearsTotal)
  );
  const surchargeEnabled = isTruthyFlag(
    p.flagSurcharge ?? p.flag_surcharge ?? bill.flag_surcharge ?? reading.flag_surcharge
  );
  const latePaymentCharge = surchargeEnabled
    ? roundMoney(Math.max(0, num(firstValue(p, [
        'surchargeAmount',
        'surcharge_amount',
        'latePaymentCharge',
        'late_payment_charge',
        'LatePaymentCharge',
      ], firstValue(bill, ['surcharge_amount'], firstValue(reading, ['surcharge_amount'], 0))))))
    : 0;
  const amountDue = roundMoney(currentBill + arrearsTotal);

  return {
    subTotal,
    currentBill,
    arrears,
    arrearsTotal,
    latePaymentCharge,
    amountDue,
    amountAfterDueDate: roundMoney(amountDue + latePaymentCharge),
  };
}

function invoiceSummaryRows(invoice, dueDate, disconnectionDate) {
  const summary = invoiceSummaryValues(invoice);
  const rows = [
    flexibleCol('SUB TOTAL', money(summary.subTotal)),
    flexibleCol('TOTAL CURRENT BILL', `Php ${money(summary.currentBill)}`),
    flexibleCol('ARREARS', money(summary.arrearsTotal)),
  ];

  summary.arrears.forEach((row) => {
    rows.push(`${String(row.billMonth || 'Arrears').padStart(20, ' ')} - ${money(row.amount)}`);
  });

  rows.push(
    SEP,
    largeBoldText(flexibleCol('TOTAL AMOUNT DUE', `Php ${money(summary.amountDue)}`)),
    flexibleCol('LATE PAYMENT CHARGE AFTER DUE DATE:', money(summary.latePaymentCharge)),
    center('ERC Resolution No. 30, series of 2026'),
    largeBoldText(flexibleCol('TOTAL AMOUNT AFTER DUE DATE', `Php ${money(summary.amountAfterDueDate)}`)),
    flexibleCol('DUE DATE (Current billing)', dueDate || ''),
    flexibleCol('DISCO DATE (Current billing)', disconnectionDate || ''),
  );

  return rows;
}

function printMetaRows(meta = {}, fallbackAccn = '') {
  const accn = meta.accn || fallbackAccn;
  const range = meta.latBillNo || '';
  const rows = [];
  if (accn) rows.push(`ACCN: ${accn}`);
  rows.push(`Range of Approved Numbers :`);
  rows.push(range || '____________________________');
  rows.push(`Date Issued : ${meta.dateIssued || meta.dateUsage || 'November 15,2024'}`);
  return rows;
}

function qrPayloadRows(accountNumber, billMonth, amount) {
  const data = [
    `ACCOUNTNUMBER=${accountNumber || ''}`,
    `BILLMONTH=${billMonth || ''}`,
    `TOTALAMOUNT=${money(amount)}`,
  ].join(';');
  return [qrDataCommand(data)];
}

function isTruthyFlag(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'y' || text === 'yes';
}

function birSalesSummary(reading = {}, bill = {}, p = {}) {
  const lifeline = isTruthyFlag(
    reading.flag_lifeline ??
      reading.flaglifeline ??
      reading.flagLifeline ??
      reading.Lifeline ??
      bill.flag_lifeline ??
      bill.flaglifeline
  );
  const distributionVatable =
    sourceAmount(bill, ['DCDemandCharge']) +
    sourceAmount(bill, ['DCDistributionCharge']) +
    sourceAmount(bill, ['MCSystemCharge']) +
    sourceAmount(bill, ['MCRetailCustCharge']) +
    sourceAmount(bill, ['SCRetCustCharge']) +
    sourceAmount(bill, ['SCSupplySysCharge']) +
    (lifeline ? 0 : sourceAmount(bill, ['LifelineDiscSubs']));

  const otherVatRate = num(reading.Vat_Other ?? bill.Vat_Other);
  const otherVat =
    sourceAmount(bill, ['EVAT_OtherVat']) ||
    [1, 2, 3].reduce((sum, index) => {
      const flag = reading[`OCFlag${index}_Vat`] ?? bill[`OCFlag${index}_Vat`];
      if (!isTruthyFlag(flag)) return sum;
      return roundInternal(sum + sourceAmount(bill, [`OCAmount${index}`, `OCTotal${index}`]) * otherVatRate);
    }, 0);
  const vat12 = roundMoney(sourceAmount(bill, ['EVAT_Dist_Charge']) + otherVat);
  const realPropertyTax = sourceAmount(bill, ['RealPropertyTax']);

  return {
    vatableSales: roundMoney(distributionVatable),
    vatExemptSales: roundMoney(realPropertyTax),
    vatZeroRatedSales: roundMoney(realPropertyTax),
    vat12,
    totalSales: roundMoney(distributionVatable + vat12),
  };
}

function invoiceFooterRows(invoice, options = {}) {
  const p = invoice.printableInvoice || invoice;
  const bill = invoice.printSources?.billhistory || {};
  const accountNumber = p.accountNumber || bill.AccountNumber || '';
  const billMonth = p.billMonth || bill.BillMonth || '';
  const totalBill = invoiceSummaryValues(invoice).amountDue;
  const rows = [
    ...wrapText('Payment of this bill does not mean payment of previous delinquencies, if any.', PRINT_WIDTH),
    center('A 10 day grace period is allowed'),
    ...wrapText('for payment of your accounts, please pay on or before the due date to prevent disconnection without further notice.', PRINT_WIDTH),
    ...qrPayloadRows(accountNumber, billMonth, totalBill),
    ...printMetaRows(options.printSetup || {}, `${accountNumber}-${billMonth}`),
  ];
  if (options.footerTitle !== false) {
    rows.push(options.footerTitle || '****** THIS IS A SYSTEM GENERATED INVOICE ******');
  }
  return rows;
}

function createActualInvoicePrintText(invoice, options = {}) {
  const p = invoice.printableInvoice || invoice;
  const reading = invoice.printSources?.reading || {};
  const bill = invoice.printSources?.billhistory || {};
  const kwh = num(bill.KilowattHour ?? bill.Diff ?? p.computedKwh);
  const birSummary = birSalesSummary(reading, bill, p);

  const readingRows = [
    'FROM DATE   PREV RDG',
    `${String(p.previousReadingDate || bill.PreviousReadingDate || '').slice(0, 10).padEnd(12, ' ')}${String(
      p.previousReading ?? bill.PreviousReadingKWH ?? ''
    ).padStart(8, ' ')}`,
    'TO DATE     PRES RDG KWH USED',
    `${String(p.presentReadingDate || bill.PresentReadingDate || '').slice(0, 10).padEnd(12, ' ')}${String(
      p.presentReading ?? bill.PresentReadingKWH ?? ''
    ).padStart(8, ' ')} ${String(kwh).padStart(8, ' ')}`,
  ];

  const rows = [
    ...headerRows(),
    options.tin ? center(`VAT Reg. TIN ${options.tin}`) : '',
    SEP,
    largeBoldText(center(options.title || 'BILLING INVOICE')),
    SEP,
    twoCol('Account#', p.accountNumber || bill.AccountNumber),
    twoCol('Name', p.consumerName || bill.Name),
    twoCol('Address', p.address || bill.Address),
    twoCol(
      'TIN',
      firstValue(reading, ['TIN', 'tin', 'TinNo', 'TINNo', 'TinNumber', 'ConsumerTIN', 'TaxIdentificationNumber'], '')
    ),
    twoCol('Type', p.rateCode || bill.RateCode),
    twoCol('Meter No.', p.serialNumber || bill.Serial),
    twoCol('OR Number', p.officialReceiptNo || bill.ornumber || '0'),
    twoCol('INVOICE #', p.referenceNumber || bill.BillNumber),
    twoCol('Bill Month', formatBillMonth(p.billMonth || bill.BillMonth)),
    twoCol('Date/Time', p.printedAt || new Date().toLocaleString()),
    twoCol('Read by', p.meterReaderName || options.readerName || ''),
    '',
    ...readingRows,
    twoCol('KWH', kwh),
    twoCol('Multiplier', p.multiplier || bill.Multiplier || 1),
    ...(num(p.demandKwh ?? bill.Demand) > 0 ? [twoCol('Demand', p.demandKwh ?? bill.Demand)] : []),
    '',
  ];

  rows.push(largeBoldText(center('UNBUNDLED RATES')));

  rows.push(...newFormatActualRows(reading, bill));

  rows.push(
    DOUBLE_SEP,
    ...invoiceSummaryRows(
      invoice,
      p.dueDate || firstValue(reading, ['Sched_DueDate']),
      p.disconnectionDate || firstValue(reading, ['disconnection_date', 'DiscoDate', 'Sched_DisconnectionDate'])
    ),
    '',
    twoCol('VATABLE SALES', money(birSummary.vatableSales)),
    twoCol('VAT EXEMPT SALES', money(birSummary.vatExemptSales)),
    twoCol('VAT ZERO-RATED SALES', money(birSummary.vatZeroRatedSales)),
    twoCol('VAT (12%)', money(birSummary.vat12)),
    twoCol('TOTAL SALES', money(birSummary.totalSales)),
    '',
    twoCol('Read by', p.meterReaderName || options.readerName || ''),
    ...invoiceFooterRows(invoice, options),
    '\n\n'
  );

  return rows.join('\n');
}

function createInvoicePrintText(invoice, options = {}) {
  if (invoice.printSources) return createActualInvoicePrintText(invoice, options);
  const p = invoice.printableInvoice || invoice;
  const rows = [
    ...headerRows(),
    options.tin ? center(`VAT Reg. TIN ${options.tin}`) : '',
    SEP,
    largeBoldText(center('BILLING INVOICE')),
    SEP,
    line('Account# :', p.accountNumber),
    line('Name     :', p.consumerName),
    line('Address  :', p.address),
    line('Type     :', p.rateCode),
    line('Meter No.:', p.serialNumber),
    line('OR Number:', p.officialReceiptNo || '0'),
    line('INVOICE #:', p.referenceNumber),
    line('Bill Month:', formatBillMonth(p.billMonth)),
    line('Date/Time:', p.printedAt || new Date().toLocaleString()),
    line('Read by  :', p.meterReaderName || options.readerName || ''),
    '',
    'FROM DATE   PREV RDG',
    `${String(p.previousReadingDate || '').slice(0, 10).padEnd(12, ' ')}${String(p.previousReading ?? '').padStart(8, ' ')}`,
    'TO DATE     PRES RDG KWH USED',
    `${String(p.presentReadingDate || '').slice(0, 10).padEnd(12, ' ')}${String(p.presentReading ?? '').padStart(8, ' ')} ${String(
      p.computedKwh ?? ''
    ).padStart(8, ' ')}`,
    line('Multiplier:', p.multiplier),
  ];

  if (p.importKwh != null || p.exportKwh != null) {
    rows.push(line('Import kWh', p.importKwh));
    rows.push(line('Export kWh', p.exportKwh));
    rows.push(line('Net kWh', p.netKwh));
  }

  rows.push(SEP);
  rows.push(largeBoldText(center('UNBUNDLED RATES')));
  rows.push(...newFormatComputedRows(invoice));

  if (p.netMeteringExportCredit) rows.push(line('Outgoing Gen Credit', `P${money(p.netMeteringExportCredit)}`));
  if (p.previousMonthCredit) rows.push(line('Previous Month Credit', `P${money(p.previousMonthCredit)}`));
  if (p.netMeteringCredit) rows.push(line('Net Meter Credit', `P${money(p.netMeteringCredit)}`));

  rows.push(
    DOUBLE_SEP,
    ...invoiceSummaryRows(invoice, p.dueDate, p.disconnectionDate),
    '',
    line('VATABLE SALES:', `P${money(Number(p.totalBill || 0) - Number(p.vatSubtotal || 0))}`),
    line('VAT (12%):', `P${money(p.vatSubtotal)}`),
    line('TOTAL SALES:', `P${money(p.totalBill)}`),
    '',
    line('Read by', p.meterReaderName || options.readerName || ''),
    ...invoiceFooterRows(invoice, options),
    '\n\n'
  );

  return rows.join('\n');
}

function createPaymentCollectionPrintText(payment, options = {}) {
  const arrears = payment.arrears || [];
  const rows = [
    ...headerRows(),
    options.tin ? `TIN ${options.tin}` : '',
    SEP,
    "OR's Report - Payment Collection",
    SEP,
    line('Bill Month', payment.billMonth),
    line('Print Date/Time', payment.datePaid || new Date().toLocaleString()),
    line('Collector Name', payment.collectorName || options.collectorName || ''),
    line('Official Receipt #', payment.orNumber),
    '',
    'Name          Account      Amount',
    SEP,
    `${String(payment.name || '').slice(0, 13).padEnd(13, ' ')} ${String(payment.accountNumber || '').padEnd(10, ' ')} ${money(payment.amountDue)}`,
    '',
  ];

  if (arrears.length > 0) {
    rows.push('Arrears Paid:');
    arrears.forEach((row) => {
      rows.push(twoCol(row.BillMonth || row.billMonth || 'Arrears', money(row.TotalBill || row.balance_previous || row.amount)));
    });
    rows.push('');
  }

  rows.push(
    line('Total Amount:', money(payment.amountDue)),
    '',
    'Cash Count:',
    'Peso        Count        Amount',
    SEP,
    ...['0.25', '1.00', '5.00', '10.00', '20.00', '50.00', '100.00', '200.00', '500.00', '1,000.00', 'Check'].map(
      (pesoLabel) => `${pesoLabel.padEnd(10, ' ')} _______   _______`
    ),
    '',
    'Total Amount: ______________',
    '',
    "Collector's Signature",
    '\n\n'
  );
  return rows.join('\n');
}

function createOfficialReceiptPrintText(payment, options = {}) {
  const arrears = payment.arrears || [];
  const rows = [
    ...headerRows(),
    SEP,
    center('OFFICIAL RECEIPT'),
    SEP,
    twoCol('OR Number', payment.orNumber || ''),
    twoCol('Date', payment.datePaid || new Date().toLocaleString('en-PH')),
    '',
    twoCol('Account No.', payment.accountNumber || ''),
    twoCol('Consumer', payment.name || ''),
    twoCol('Bill Month', payment.billMonth || ''),
    twoCol('Meter No.', payment.meterNumber || ''),
    '',
    twoCol('Pres. Reading', payment.presentReading ?? 'N/A'),
    twoCol('kWh Used', payment.kwhUsed != null ? `${payment.kwhUsed} kWh` : 'N/A'),
    SEP,
    twoCol('Bill Amount', `PHP ${money(payment.billAmount)}`),
    twoCol('Arrears/Penalty', `PHP ${money(payment.arrearsTotal)}`),
  ];

  if (arrears.length > 0) {
    rows.push('');
    rows.push('Arrears Paid:');
    arrears.forEach((row) => {
      rows.push(twoCol(row.BillMonth || row.billMonth || 'Arrears', `PHP ${money(row.TotalBill || row.balance_previous || row.amount)}`));
    });
    rows.push('');
  }

  rows.push(
    DOUBLE_SEP,
    twoCol('AMOUNT DUE', `PHP ${money(payment.amountDue)}`),
    twoCol('AMOUNT PAID', `PHP ${money(payment.amountPaid)}`),
    twoCol('CHANGE', `PHP ${money(payment.change)}`),
    twoCol('Method', String(payment.paymentMethod || 'cash').toUpperCase()),
    SEP,
    twoCol('Collector', payment.collectorName || options.collectorName || ''),
    '',
    center('Thank you for your payment!'),
    payment.dueDate ? center(`Due Date: ${payment.dueDate}`) : '',
    center('This is a computer-generated receipt.'),
    '\n\n'
  );
  return rows.filter((row) => row !== '').join('\n');
}

function createProvisionalReceiptPrintText(invoice, payment = {}, options = {}) {
  const p = invoice?.printableInvoice || invoice || {};
  const bill = invoice?.printSources?.billhistory || {};
  const qrData =
    options.qrData ||
    [
      `ACCOUNT=${payment.accountNumber || p.accountNumber || bill.AccountNumber || ''}`,
      `BILLMONTH=${payment.billMonth || p.billMonth || bill.BillMonth || ''}`,
      `AMOUNT=${money(payment.amountDue ?? p.totalBill ?? bill.TotalBill)}`,
    ].join(';');
  const invoiceText = createInvoicePrintText(invoice, {
    ...options,
    title: 'PROVISIONAL RECEIPT',
    footerTitle: false,
  }).replace(/\n+\*{5} SYSTEM GENERATED INVOICE \*{5}\n*/i, '\n');

  const footerRows = [
    '',
    twoCol('Collector Sign', '____________________'),
    twoCol('Collector Name', payment.collectorName || p.meterReaderName || options.collectorName || ''),
    twoCol('Date Paid', payment.datePaid || new Date().toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })),
    twoCol('Provisional Permit No.', options.printSetup?.permitNo || '_____'),
    'Range of Approved Numbers :',
    options.printSetup?.latBillNo || '____________________________',
    twoCol('Date Issued', options.printSetup?.dateIssued || options.printSetup?.dateUsage || 'November 15,2024'),
    '',
    ...wrapText(
      'This serves as your system generated temporary receipt. Official Receipt can be taken from the payment station.',
      PRINT_WIDTH
    ),
    '',
    qrDataCommand(qrData),
    '',
    '\n\n',
  ];
  return `${invoiceText.trimEnd()}\n${footerRows.join('\n')}`;
}

function createCollectionReportPrintText(report = {}, options = {}) {
  const payments = report.payments || [];
  const stats = report.stats || {};
  const assignment = report.assignment || {};
  const mode = options.mode || report.mode || 'reading';
  const title = mode === 'disconnection' ? 'DISCO COLLECTION REPORT' : 'READING COLLECTION REPORT';
  const total = payments.reduce((sum, payment) => sum + num(payment.TotalBill || payment.amountPaid), 0);
  const denominations = ['0.25', '1.00', '5.00', '10.00', '20.00', '50.00', '100.00', '200.00', '500.00', '1,000.00', 'Check'];
  const rows = [
    ...headerRows(),
    SEP,
    center(title),
    SEP,
    twoCol('Area/Book', `${assignment.areaName || ''} ${assignment.bookNumber || ''}`.trim()),
    twoCol('Bill Month', assignment.billMonth || ''),
    twoCol('Print Date', new Date().toLocaleString('en-PH')),
    twoCol('Payments', payments.length),
    twoCol('Total Collected', `PHP ${money(total || stats.totalCollectionMonth)}`),
    '',
    'OR No.      Account        Amount',
    SEP,
  ];

  payments.forEach((payment) => {
    const orNumber = String(payment.ornumber || payment.orNumber || '-').slice(0, 10).padEnd(10, ' ');
    const account = String(payment.AccountNumber || payment.accountNumber || '').slice(0, 12).padEnd(12, ' ');
    const amount = money(payment.TotalBill || payment.amountPaid).slice(0, 12).padStart(12, ' ');
    rows.push(`${orNumber}${account}${amount}`);
  });

  if (payments.length === 0) rows.push('No payments found.');

  rows.push(
    SEP,
    twoCol('TOTAL', `PHP ${money(total || stats.totalCollectionMonth)}`),
    '',
    'Cash Count:',
    'Denomination     Count       Amount',
    SEP,
    ...denominations.map((pesoLabel) => `${pesoLabel.padEnd(16, ' ')}_______   _______`),
    SEP,
    'Cash Total: __________________________',
    'Check Total: _________________________',
    'Grand Total: _________________________',
    '',
    "Collector's Signature",
    '\n\n'
  );
  return rows.join('\n');
}

function createSummaryReportPrintText(report = {}, options = {}) {
  const stats = report.stats || {};
  const assignment = report.assignment || {};
  const mode = options.mode || report.mode || stats.mode || 'reading';
  const isDisco = mode === 'disconnection';
  const rows = [
    ...headerRows(),
    SEP,
    center(isDisco ? 'DISCO REPORT SUMMARY' : 'READING REPORT SUMMARY'),
    SEP,
    twoCol('Area/Book', `${assignment.areaName || ''} ${assignment.bookNumber || ''}`.trim()),
    twoCol('Bill Month', assignment.billMonth || ''),
    twoCol('Print Date', new Date().toLocaleString('en-PH')),
    twoCol(isDisco ? 'Last Disco' : 'Last Reading', shortDateTime(isDisco ? stats.lastDiscoTimestamp : stats.lastReadingTimestamp) || 'N/A'),
    '',
    twoCol('Total Records', stats.totalRecords || 0),
    twoCol('Read', stats.readRecords || 0),
    twoCol('Unread', stats.unreadRecords || 0),
    twoCol('Paid', stats.paidRecords || 0),
    twoCol('Disconnected', stats.disconnectedRecords || 0),
    twoCol('Problems', stats.problemReports || 0),
    '',
    twoCol('Collection Today', `PHP ${money(stats.totalCollectionToday)}`),
    twoCol('Collection Month', `PHP ${money(stats.totalCollectionMonth)}`),
    twoCol('Amount Due', `PHP ${money(stats.totalAmountDue)}`),
    '\n\n',
  ];
  return rows.join('\n');
}

function createComplaintReportPrintText(report = {}, options = {}) {
  const complaints = report.complaints || [];
  const assignment = report.assignment || {};
  const rows = [
    ...headerRows(),
    SEP,
    center('COMPLAINT REPORT'),
    SEP,
    twoCol('Area/Book', `${assignment.areaName || ''} ${assignment.bookNumber || ''}`.trim()),
    twoCol('Print Date', new Date().toLocaleString('en-PH')),
    twoCol('Total Reports', complaints.length),
    '',
  ];

  complaints.forEach((item, index) => {
    rows.push(`${index + 1}. ${String(item.accountNumber || '').slice(0, 16)} ${String(item.priority || '').toUpperCase()}`);
    rows.push(String(item.consumerName || '').slice(0, 40));
    rows.push(String(item.reportType || '').replace(/_/g, ' ').toUpperCase());
    wrapText(item.remarks || '', 40).forEach((row) => rows.push(row));
    rows.push(twoCol('Date', shortDateTime(item.createdAt)));
    rows.push(SEP);
  });

  if (complaints.length === 0) rows.push('No complaint reports found.');

  rows.push('', 'Prepared By: __________________', '\n\n');
  return rows.join('\n');
}

function createDisconnectionNoticePrintText(invoice, options = {}) {
  const p = invoice.printableInvoice || invoice;
  const bill = invoice.printSources?.billhistory || {};
  const currentBill = num(bill.TotalBill ?? p.totalBill);
  const arrearsTotal = arrearsRows(invoice).reduce((sum, row) => sum + num(row.amount), 0);
  const totalBill = roundMoney(currentBill + arrearsTotal);
  const accountNumber = p.accountNumber || bill.AccountNumber;
  const billMonth = p.billMonth || bill.BillMonth;
  const noticeDate = options.noticeDate || new Date().toLocaleString('en-PH');
  const rows = [
    ...headerRows(),
    SEP,
    center('DISCONNECTION NOTICE'),
    SEP,
    noticeLine('Account#', `: ${accountNumber || ''}`),
    noticeLine('Name', `: ${p.consumerName || bill.Name || ''}`),
    noticeLine('Address', `: ${p.address || bill.Address || ''}`),
    noticeLine('Meter No.', `: ${p.serialNumber || bill.Serial || ''}`),
    noticeLine('Type', `: ${p.rateCode || bill.RateCode || ''}`),
    noticeLine('Bill Month', `: ${billMonth || ''}`),
    noticeLine('Date/Time', `: ${shortDateTime(noticeDate)}`),
    '',
    `${'Total Bill'.padEnd(20, ' ')}: ${money(totalBill)}`,
    '',
    ...wrapText('Alayon pagbayad han iyo kabaraydan pag malikayan nga mautdan hin kuryente an iyo panimalay. Damo nga salamat', 40),
    '',
    noticeLine('Adlaw han pag-utod', ':'),
    '',
    `Issued By : ${p.meterReaderName || options.readerName || ''}`,
    '',
    '\n\n',
  ];
  return rows.join('\n');
}

function normalizePrinterType(type = 'woosim') {
  if (type === 'generic' || type === 'generic_escpos' || type === 'escpos') return 'generic_escpos';
  if (type === 'woosim') return 'woosim';
  return 'other';
}

function createEscPosTextPayload(text) {
  return {
    transportEncoding: 'latin1',
    encoding: 'text',
    commandSet: 'escpos',
    init: '\x1b@',
    body: text,
    feedAndCut: '\n\n\n\x1dV\x00',
  };
}

function createWoosimTextPayload(text) {
  return {
    transportEncoding: 'latin1',
    encoding: 'text',
    commandSet: 'woosim',
    init: '\x1b@',
    body: text,
    feed: '\n\n\n',
  };
}

function createPrinterPayload(text, options = {}) {
  const printerType = normalizePrinterType(options.printerType);
  if (printerType === 'generic_escpos') return createEscPosTextPayload(text);
  if (printerType === 'woosim') return createWoosimTextPayload(text);
  return { transportEncoding: 'latin1', encoding: 'text', commandSet: 'plain_text', body: text };
}

async function printInvoice(invoice, options = {}) {
  const payload = createInvoicePrintText(invoice, options);
  const transportPayload = createPrinterPayload(payload, options);
  // Hook this payload to Woosim or generic ESC/POS Bluetooth transport.
  // Keep the formatted text centralized so the native Bluetooth layer can be swapped safely.
  return {
    ok: false,
    message: 'Bluetooth transport is not connected yet.',
    payload,
    transportPayload,
    printerType: normalizePrinterType(options.printerType),
  };
}

module.exports = {
  createEscPosTextPayload,
  createActualInvoicePrintText,
  createCollectionReportPrintText,
  createComplaintReportPrintText,
  createOfficialReceiptPrintText,
  createPaymentCollectionPrintText,
  createProvisionalReceiptPrintText,
  createDisconnectionNoticePrintText,
  createInvoicePrintText,
  createPrinterPayload,
  createSummaryReportPrintText,
  createWoosimTextPayload,
  printInvoice,
};
