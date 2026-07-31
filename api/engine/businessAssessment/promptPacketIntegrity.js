export const PROMPT_PACKET_INTEGRITY_VERSION = 'prompt_packet_integrity_v1';

const COMPACTION_PROFILES = Object.freeze([
  { maxStringCharacters: Infinity, maxArrayItems: Infinity },
  { maxStringCharacters: 4000, maxArrayItems: 50 },
  { maxStringCharacters: 2000, maxArrayItems: 25 },
  { maxStringCharacters: 1000, maxArrayItems: 12 },
  { maxStringCharacters: 500, maxArrayItems: 8 },
  { maxStringCharacters: 250, maxArrayItems: 5 },
  { maxStringCharacters: 120, maxArrayItems: 5 },
  { maxStringCharacters: 80, maxArrayItems: 5 },
  { maxStringCharacters: 40, maxArrayItems: 5 },
]);

export const BOS_BEHAVIORAL_EVIDENCE_PATHS = Object.freeze([
  'canonical_profile_snapshot',
  'business_intelligence_draft.behavioral_reality',
  'business_intelligence_draft.behavior_business_fusion',
]);

function pathFor(parent, key) {
  return parent ? `${parent}.${key}` : String(key);
}

function isPreservedPath(path, preservedPaths) {
  return preservedPaths.some(
    (preserved) => path === preserved || path.startsWith(`${preserved}.`) || path.startsWith(`${preserved}[`),
  );
}

function compactValue(value, profile, omissions, preservedPaths, path = '') {
  const preserve = isPreservedPath(path, preservedPaths);
  if (typeof value === 'string') {
    if (preserve || value.length <= profile.maxStringCharacters) return value;
    omissions.push({
      path,
      reason: 'string_compacted',
      omitted_characters: value.length - profile.maxStringCharacters,
    });
    return `${value.slice(0, profile.maxStringCharacters)}\n[OMITTED ${value.length - profile.maxStringCharacters} CHARACTERS]`;
  }

  if (Array.isArray(value)) {
    const retained = preserve ? value : value.slice(0, profile.maxArrayItems);
    if (retained.length < value.length) {
      omissions.push({
        path,
        reason: 'array_compacted',
        omitted_items: value.length - retained.length,
      });
    }
    return retained.map((item, index) => (
      compactValue(item, profile, omissions, preservedPaths, `${path}[${index}]`)
    ));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== '_packet_integrity')
        .sort()
        .map((key) => [
          key,
          compactValue(value[key], profile, omissions, preservedPaths, pathFor(path, key)),
        ]),
    );
  }

  return value;
}

function assertRequiredFields(value, requiredTopLevelKeys) {
  const missing = requiredTopLevelKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(value, key),
  );
  if (missing.length > 0) {
    throw new Error(`prompt_packet_missing_required_fields:${missing.join(',')}`);
  }
}

function buildIntegrity(profile, omissions, maxCharacters) {
  return {
    version: PROMPT_PACKET_INTEGRITY_VERSION,
    compacted: omissions.length > 0,
    character_limit: maxCharacters,
    max_string_characters: Number.isFinite(profile.maxStringCharacters)
      ? profile.maxStringCharacters
      : null,
    max_array_items: Number.isFinite(profile.maxArrayItems) ? profile.maxArrayItems : null,
    omitted_path_count: omissions.length,
    omitted_paths: omissions.slice(0, 40),
  };
}

export function serializePromptPacket(value, {
  maxCharacters,
  requiredTopLevelKeys = [],
  preservedPaths = [],
} = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('prompt packet must be an object');
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 512) {
    throw new TypeError('prompt packet maxCharacters must be an integer >= 512');
  }

  assertRequiredFields(value, requiredTopLevelKeys);
  let smallestCharacterCount = null;

  for (const profile of COMPACTION_PROFILES) {
    const omissions = [];
    const compacted = compactValue(value, profile, omissions, preservedPaths);
    assertRequiredFields(compacted, requiredTopLevelKeys);
    compacted._packet_integrity = buildIntegrity(profile, omissions, maxCharacters);
    const json = JSON.stringify(compacted);
    smallestCharacterCount = smallestCharacterCount === null
      ? json.length
      : Math.min(smallestCharacterCount, json.length);
    if (json.length <= maxCharacters) {
      return {
        json,
        value: compacted,
        diagnostics: compacted._packet_integrity,
      };
    }
  }

  throw new Error(`prompt_packet_cannot_fit:${maxCharacters}:smallest=${smallestCharacterCount}`);
}
