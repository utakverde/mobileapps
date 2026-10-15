const DEFAULT_SENIOR_RATE = 0.05;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isActiveFlag(value) {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return ['1', 'Y', 'YES', 'TRUE', 'ACTIVE'].includes(value.trim().toUpperCase());
  }
  return false;
}

function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function roundInternal(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100000000) / 100000000;
}

function computeLifelineDiscount({
  computedKwh,
  flagLifeline,
  totalBeforeDiscount,
  otherChargesTotal,
  lifelineDiscountRate,
}) {
  if (computedKwh > 50 || !isActiveFlag(flagLifeline)) {
    return { eligible: false, amount: 0, base: 0 };
  }

  const base = Math.max(0, toNumber(totalBeforeDiscount) - toNumber(otherChargesTotal));
  const rate = Math.max(0, toNumber(lifelineDiscountRate));
  return {
    eligible: true,
    amount: -1 * roundInternal(base * rate),
    base: roundInternal(base),
  };
}

function computeSeniorDiscount({
  computedKwh,
  seniorFlag,
  lifelineEligible,
  generationSubtotal,
  transmissionSubtotal,
  distributionRevenueSubtotalWithoutRFSC,
  seniorDiscountRate = DEFAULT_SENIOR_RATE,
}) {
  if (computedKwh > 100 || lifelineEligible || !isActiveFlag(seniorFlag)) {
    return { eligible: false, amount: 0, base: 0 };
  }

  const base =
    toNumber(generationSubtotal) +
    toNumber(transmissionSubtotal) +
    toNumber(distributionRevenueSubtotalWithoutRFSC);

  return {
    eligible: true,
    amount: -1 * roundInternal(base * toNumber(seniorDiscountRate, DEFAULT_SENIOR_RATE)),
    base: roundInternal(base),
  };
}

module.exports = {
  DEFAULT_SENIOR_RATE,
  computeLifelineDiscount,
  computeSeniorDiscount,
  isActiveFlag,
  roundInternal,
  roundMoney,
  toNumber,
};
