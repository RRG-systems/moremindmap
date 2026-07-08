import {
  BACard,
  BACardIfContent,
  CustomerSafeText,
  CustomerSafeListItems,
  sanitizeCustomerMarkdown,
} from './BAReadableSection.jsx';
import { customerDisplayLabel, mapLabelsForCustomer } from '../../lib/businessAssessment/customerPresentationHelpers.js';

function resolveList(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.filter(Boolean).length) {
      return candidate.filter(Boolean);
    }
  }
  return [];
}

export default function BAConfidenceEvidenceSection({ vm, lang }) {
  const cs = vm.confidence_summary || {};
  const l = lang?.confidence_reality;
  const missingData = vm.missing_data || {};

  const knows = resolveList(
    l?.what_system_knows,
    cs.what_system_knows,
    cs.known_labels,
    mapLabelsForCustomer(cs.known_raw || [], { technical: true })
  );
  const infers = resolveList(
    l?.what_system_infers,
    cs.what_system_infers,
    cs.inferred_labels,
    mapLabelsForCustomer(cs.inferred_raw || [], { technical: true })
  );
  const missing = resolveList(
    l?.what_is_missing,
    cs.missing_labels,
    missingData.financial_labels,
    mapLabelsForCustomer(missingData.financial || [], { technical: true }),
    mapLabelsForCustomer(cs.missing_raw || [], { technical: true })
  ).map((item) => customerDisplayLabel(item, { technical: true }) || item);

  const bandTitle = sanitizeCustomerMarkdown(
    l?.band_plain ||
      `Confidence: ${cs.band || 'unknown'}${
        Number.isFinite(cs.score) ? ` (${cs.score}/100)` : ''
      }`
  );

  return (
    <div className="space-y-4">
      <BACard title={bandTitle} badge="Confidence">
        <CustomerSafeText text={l?.headline || cs.headline} className="text-sm text-white/75" />
      </BACard>
      <div className="grid gap-4 md:grid-cols-2">
        <BACardIfContent
          title="What the System Knows"
          content={knows}
          fallback="No explicit known-evidence list is stored for this assessment."
        >
          <CustomerSafeListItems items={knows} />
        </BACardIfContent>
        <BACardIfContent
          title="What It Is Inferring"
          content={infers}
          fallback="No explicit inferred-evidence list is stored for this assessment."
        >
          <CustomerSafeListItems items={infers} />
        </BACardIfContent>
      </div>
      <BACardIfContent title="What Is Missing" content={missing.length ? missing : true}>
        {missing.length ? (
          <CustomerSafeListItems items={missing} />
        ) : (
          <p className="text-sm text-white/60">No missing-field list was stored.</p>
        )}
        <div className="mt-3">
          <CustomerSafeText
            text={l?.customer_note || missingData.customer_note}
            className="text-sm text-white/60"
          />
        </div>
      </BACardIfContent>
      <BACard title="Confidence Counts">
        <CustomerSafeText
          text={
            l?.counts_plain ||
            `Known: ${cs.known_count ?? 0} · Observed: ${cs.observed_count ?? 0} · Inferred: ${
              cs.inferred_count ?? 0
            } · Missing: ${cs.missing_count ?? 0}`
          }
          className="text-sm text-white/75"
        />
      </BACard>
    </div>
  );
}
