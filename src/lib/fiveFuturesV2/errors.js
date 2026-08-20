export class FiveFuturesV2IntegrityError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'FiveFuturesV2IntegrityError';
    this.code = code;
    this.details = details;
  }
}

export function integrity(condition, code, message, details = {}) {
  if (!condition) throw new FiveFuturesV2IntegrityError(code, message, details);
}
