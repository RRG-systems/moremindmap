export class WholeBusinessModelIntegrityError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'WholeBusinessModelIntegrityError';
    this.code = code;
    this.details = details;
  }
}

export function integrity(condition, code, message, details = {}) {
  if (!condition) throw new WholeBusinessModelIntegrityError(code, message, details);
}
