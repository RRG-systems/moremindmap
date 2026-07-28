import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { deepFreeze } from '../../../validation.js';

export const OIDC_TRANSACTION_VERSION = 'private-runtime-oidc-transaction-v1';

const frozen = (value) => deepFreeze(structuredClone(value));
const base64url = (value) => Buffer.from(value).toString('base64url');
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function keyFrom(material) {
  if (typeof material !== 'string' || material.length < 32) {
    throw new TypeError('OIDC transaction key material is unavailable');
  }
  return crypto.createHash('sha256')
    .update('more-private-runtime-oidc-transaction-v1\0')
    .update(material)
    .digest();
}

function validatePayload(value, nowMs) {
  const rotationFieldsValid = value?.rotation_parent_session_token_hash == null
    && value?.rotation_parent_reference == null
    || sha256(value?.rotation_parent_session_token_hash)
      && typeof value?.rotation_parent_reference === 'string'
      && value.rotation_parent_reference.length >= 3
      && value.rotation_parent_reference.length <= 512;
  return value
    && value.transaction_version === OIDC_TRANSACTION_VERSION
    && typeof value.pre_auth_session_ref === 'string'
    && sha256(value.state_hash)
    && sha256(value.nonce_hash)
    && typeof value.pkce_verifier === 'string'
    && value.pkce_verifier.length >= 43
    && value.pkce_verifier.length <= 128
    && sha256(value.browser_binding_hash)
    && typeof value.environment_id === 'string'
    && timestamp(value.issued_at)
    && timestamp(value.expires_at)
    && Date.parse(value.expires_at) > Date.parse(value.issued_at)
    && Date.parse(value.expires_at) > nowMs
    && rotationFieldsValid;
}

export function createOidcTransactionCodecV1({
  keyMaterial,
  randomBytes = crypto.randomBytes,
  clock = () => Date.now(),
} = {}) {
  const key = keyFrom(keyMaterial);

  return Object.freeze({
    seal(payload) {
      if (!validatePayload(payload, clock())) {
        throw new TypeError('OIDC transaction payload is invalid');
      }
      const iv = randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(OIDC_TRANSACTION_VERSION, 'utf8'));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return `${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;
    },

    open(serialized) {
      try {
        if (typeof serialized !== 'string' || serialized.length > 4096) return null;
        const parts = serialized.split('.');
        if (parts.length !== 3) return null;
        const [iv, ciphertext, tag] = parts.map((part) => Buffer.from(part, 'base64url'));
        if (iv.length !== 12 || tag.length !== 16) return null;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(Buffer.from(OIDC_TRANSACTION_VERSION, 'utf8'));
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]).toString('utf8');
        const value = JSON.parse(plaintext);
        return validatePayload(value, clock()) ? frozen(value) : null;
      } catch {
        return null;
      }
    },
  });
}

export function oidcTransactionHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
