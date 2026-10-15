const { roundInternal, toNumber } = require('./discountCalculator');

function inferRolloverMaximum(previousReading, meterDigits) {
  const explicitDigits = Number(meterDigits);
  const digits = Number.isFinite(explicitDigits) && explicitDigits > 0
    ? explicitDigits
    : String(Math.trunc(Math.max(0, toNumber(previousReading)))).length;

  if (!Number.isFinite(digits) || digits <= 0) return null;
  return Math.pow(10, digits) - 1;
}

function isDesktopWrapAroundCandidate(previousReading) {
  const reading = Math.trunc(toNumber(previousReading));
  return (
    (reading > 800 && reading < 1000) ||
    (reading > 7000 && reading < 10000) ||
    (reading > 70000 && reading < 100000) ||
    (reading > 740000 && reading < 1000000) ||
    (reading > 9900000 && reading < 10000000) ||
    (reading > 99000000 && reading < 100000000)
  );
}

function validateReadingInput(input = {}) {
  const previousReading = toNumber(input.previousReading);
  const presentReading = Number(input.presentReading);
  const multiplier = toNumber(input.multiplier, 1) || 1;
  const allowRollover = Boolean(input.allowRollover);
  const maxReading = input.maxReading != null
    ? toNumber(input.maxReading)
    : inferRolloverMaximum(previousReading, input.meterDigits);

  if (!Number.isFinite(presentReading) || presentReading < 0) {
    return {
      ok: false,
      message: 'Enter a valid present reading.',
      computedKwh: null,
      billableKwh: null,
      rolloverApplied: false,
    };
  }

  if (presentReading < previousReading) {
    if (allowRollover && isDesktopWrapAroundCandidate(previousReading) && maxReading != null && previousReading <= maxReading) {
      const rolloverKwh = roundInternal(((maxReading - previousReading) + presentReading + 1) * multiplier);
      return {
        ok: true,
        message: 'Meter wrap-around detected. Please verify before saving.',
        computedKwh: rolloverKwh,
        billableKwh: Math.max(0, rolloverKwh),
        rolloverApplied: true,
      };
    }

    return {
      ok: false,
      message: 'Present reading is lower than previous reading. Check the meter reading before saving.',
      computedKwh: roundInternal((presentReading - previousReading) * multiplier),
      billableKwh: null,
      rolloverApplied: false,
    };
  }

  const computedKwh = roundInternal((presentReading - previousReading) * multiplier);
  if (computedKwh < 0) {
    return {
      ok: false,
      message: 'Computed kWh is negative. Check the present reading and multiplier.',
      computedKwh,
      billableKwh: null,
      rolloverApplied: false,
    };
  }

  return {
    ok: true,
    message: '',
    computedKwh,
    billableKwh: computedKwh,
    rolloverApplied: false,
  };
}

module.exports = {
  inferRolloverMaximum,
  isDesktopWrapAroundCandidate,
  validateReadingInput,
};
