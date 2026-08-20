export class OneMoveV2IntegrityError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'OneMoveV2IntegrityError';
    this.code = code;
    this.details = details;
  }
}

export function integrity(condition, code, message, details = {}) {
  if (!condition) throw new OneMoveV2IntegrityError(code, message, details);
}

