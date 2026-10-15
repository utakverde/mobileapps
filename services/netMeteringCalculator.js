const { roundInternal, roundMoney, toNumber } = require('./discountCalculator');

function computeNetMetering(input) {
  const importPrevious = toNumber(input.importPrevious);
  const importPresent = toNumber(input.importPresent);
  const exportPrevious = toNumber(input.exportPrevious);
  const exportPresent = toNumber(input.exportPresent);
  const importMultiplier = toNumber(input.importMultiplier, 1) || 1;
  const exportMultiplier = toNumber(input.exportMultiplier, 1) || 1;
  const previousMonthCredit = normalizeCreditAmount(
    input.previousMonthCredit ?? input.previousCredit ?? input.previousNetMeteringCredit
  );

  const importKwh = roundInternal((importPresent - importPrevious) * importMultiplier);
  const exportKwh = roundInternal((exportPresent - exportPrevious) * exportMultiplier);
  const netKwh = roundInternal(importKwh - exportKwh);
  const warnings = [];
  if (importKwh < 0) warnings.push('Incoming kWh is negative. Check import register readings.');
  if (exportKwh < 0) warnings.push('Outgoing kWh is negative. Check export register readings.');

  return {
    importKwh,
    exportKwh,
    netKwh,
    previousMonthCredit,
    hasBillableConsumption: netKwh > 0,
    hasExportCredit: netKwh < 0,
    creditKwh: netKwh < 0 ? Math.abs(netKwh) : 0,
    warnings,
  };
}

function normalizeCreditAmount(value) {
  const amount = roundMoney(toNumber(value));
  if (amount > 0) return -1 * amount;
  return amount;
}

module.exports = { computeNetMetering };
