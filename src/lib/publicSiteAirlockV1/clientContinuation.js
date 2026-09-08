export async function resolveStep2OwnershipContinuation({
  complimentaryReturn,
  readPrepared,
} = {}) {
  if (complimentaryReturn !== true) return 'paid';
  if (typeof readPrepared !== 'function') throw new Error('complimentary_flow_invalid');
  const prepared = await readPrepared();
  if (prepared?.product_key !== 'business_assessment') throw new Error('complimentary_flow_invalid');
  return 'complimentary';
}
