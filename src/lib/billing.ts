export function hasPayableBill(input: {
  billAmount?: number | null;
  arrearsTotal?: number | null;
  totalDue?: number | null;
  status?: string | null;
} | null | undefined) {
  if (!input) return false;
  if (String(input.status || '').toLowerCase() === 'paid') return false;
  return Boolean(
    Number(input.billAmount || 0) > 0 ||
      Number(input.arrearsTotal || 0) > 0 ||
      Number(input.totalDue || 0) > 0
  );
}
