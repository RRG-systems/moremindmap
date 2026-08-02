#!/usr/bin/env node

import crypto from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import Redis from 'ioredis';

import { resolveLayer3CustomerViewModel } from '../src/lib/bosCustomerIntelligence/customerViewModelOverlay.js';
import { buildLayer3SemanticPacket } from '../src/lib/bosCustomerIntelligence/semanticPacket.js';
import { buildLayer3CacheIdentity } from '../src/lib/bosCustomerIntelligence/translationCache.js';
import { validateLayer3SemanticPacket } from '../src/lib/bosCustomerIntelligence/translationValidator.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';

function opaqueProfileRef(profileId) {
  return `sha256:${crypto.createHash('sha256').update(String(profileId || '')).digest('hex').slice(0, 16)}`;
}

function rankedDimensions(canonical) {
  const data = canonical?.canonical_profile_json
    || canonical?.canonical_dossier?.canonical_profile_json
    || canonical
    || {};
  return data.rescoring_gpt?.ranked_dimensions?.length > 0
    ? data.rescoring_gpt.ranked_dimensions
    : data.rescoring_v1?.ranked_dimensions?.length > 0
      ? data.rescoring_v1.ranked_dimensions
      : data.ranked_dimensions || [];
}

async function withoutNarrativeLogs(action) {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await action();
  } finally {
    Object.assign(console, original);
  }
}

export async function verifyHistoricalProfileRecords(records, {
  totalVaultRecords = records.length,
} = {}) {
  const eligible = [];
  const excluded = [];

  for (const record of records) {
    const canonical = record.canonical;
    const profileId = canonical?.profile_id || record.profileId;
    if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) {
      excluded.push({
        profile_ref: opaqueProfileRef(profileId),
        reason: 'canonical_record_unavailable',
      });
      continue;
    }
    const canonicalBefore = JSON.stringify(canonical);
    try {
      const narrative = await withoutNarrativeLogs(() => (
        buildNarrativeV3(canonical, false, null, true)
      ));
      const viewModel = buildCustomerBOSViewModel({
        canonical,
        narrative,
        profileId,
        personName: canonical?.person_name,
        company: canonical?.company_name || '',
        ranked: rankedDimensions(canonical),
      });
      const packet = buildLayer3SemanticPacket(viewModel);
      const packetValidation = validateLayer3SemanticPacket(packet);
      const fallback = resolveLayer3CustomerViewModel(viewModel, packet, {
        bundle: null,
        receipt: { source: 'layer2_fallback', reason: 'historical_proof' },
      });
      const canonicalAfter = JSON.stringify(canonical);
      if (!packetValidation.valid
          || fallback !== viewModel
          || viewModel.tabs?.length !== 8
          || viewModel.overviewSections?.length !== 5
          || canonicalAfter !== canonicalBefore) {
        throw new Error('compatibility_invariant_failed');
      }
      const cacheIdentity = buildLayer3CacheIdentity(packet);
      eligible.push({
        profile_ref: opaqueProfileRef(profileId),
        layer2_version: packet.layer2_version,
        semantic_hash: packet.semantic_hash,
        surface_manifest_hash: packet.surface_manifest_hash,
        cache_identity_complete: Object.values(cacheIdentity).every(Boolean),
        exact_layer2_fallback: true,
        tabs: 8,
        overview_sections: 5,
        canonical_unchanged: true,
      });
    } catch (error) {
      excluded.push({
        profile_ref: opaqueProfileRef(profileId),
        reason: String(error?.message || 'compatibility_failed'),
      });
    }
  }

  return {
    version: 'bos_universal_retrieval_historical_compatibility_v1',
    read_only: true,
    profile_identity_logged: false,
    total_vault_records: totalVaultRecords,
    scanned_records: records.length,
    eligible_count: eligible.length,
    excluded_count: excluded.length,
    eligible,
    excluded,
  };
}

export async function verifyHistoricalProfiles({ redis }) {
  const keys = (await redis.keys('vault:profile:*')).sort();
  const records = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    try {
      records.push({
        profileId: key.replace(/^vault:profile:/, ''),
        canonical: JSON.parse(raw),
      });
    } catch {
      records.push({
        profileId: key.replace(/^vault:profile:/, ''),
        canonical: null,
      });
    }
  }
  return verifyHistoricalProfileRecords(records, { totalVaultRecords: keys.length });
}

export async function verifyHistoricalProfilesByHttp({ baseUrl }) {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  const inventoryResponse = await fetch(`${normalizedBase}/api/diagnostic/list-all-profiles`);
  if (!inventoryResponse.ok) throw new Error('historical_inventory_request_failed');
  const inventory = await inventoryResponse.json();
  const summaries = Array.isArray(inventory.all_profiles) ? inventory.all_profiles : [];
  const records = [];
  for (const summary of summaries) {
    const response = await fetch(
      `${normalizedBase}/api/moremindmap/retrieve-profile?id=${encodeURIComponent(summary.profile_id)}`,
    );
    if (!response.ok) {
      records.push({ profileId: summary.profile_id, canonical: null });
      continue;
    }
    const payload = await response.json();
    records.push({
      profileId: payload.profile_id || summary.profile_id,
      canonical: payload.canonical_dossier || null,
    });
  }
  return verifyHistoricalProfileRecords(records, {
    totalVaultRecords: Number(inventory.total_profiles) || records.length,
  });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!args.has('--confirm-read-only')) {
    throw new Error('explicit --confirm-read-only flag required');
  }
  const expectedTotalArg = process.argv.find((arg) => arg.startsWith('--expected-total='));
  const expectedScannedArg = process.argv.find((arg) => arg.startsWith('--expected-scanned='));
  const expectedEligibleArg = process.argv.find((arg) => arg.startsWith('--expected-eligible='));
  const expectedTotal = Number(expectedTotalArg?.split('=')[1]);
  const expectedScanned = Number(expectedScannedArg?.split('=')[1]);
  const expectedEligible = Number(expectedEligibleArg?.split('=')[1]);
  if (!Number.isInteger(expectedTotal)
      || !Number.isInteger(expectedScanned)
      || !Number.isInteger(expectedEligible)) {
    throw new Error('expected total, scanned, and eligible counts are required');
  }

  const baseUrlArg = process.argv.find((arg) => arg.startsWith('--base-url='));
  const baseUrl = baseUrlArg?.slice('--base-url='.length);
  let redis = null;
  try {
    let receipt;
    if (baseUrl) {
      receipt = await verifyHistoricalProfilesByHttp({ baseUrl });
    } else {
      if (!process.env.REDIS_URL) throw new Error('REDIS_URL environment variable not configured');
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      });
      receipt = await verifyHistoricalProfiles({ redis });
    }
    if (receipt.total_vault_records !== expectedTotal
        || receipt.scanned_records !== expectedScanned
        || receipt.eligible_count !== expectedEligible) {
      throw new Error(JSON.stringify({
        error: 'historical_acceptance_denominator_mismatch',
        actual_total: receipt.total_vault_records,
        actual_scanned: receipt.scanned_records,
        actual_eligible: receipt.eligible_count,
        expected_total: expectedTotal,
        expected_scanned: expectedScanned,
        expected_eligible: expectedEligible,
      }));
    }
    console.log(JSON.stringify(receipt, null, 2));
  } finally {
    redis?.disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
