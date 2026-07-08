import {
  BACard,
  CustomerSafeText,
  CustomerSafeListItems,
  sanitizeCustomerMarkdown,
} from './BAReadableSection.jsx';

export default function BAConfidenceEvidenceSection({ vm, lang }) {
  const cs = vm.confidence_summary;
  const l = lang?.confidence_reality;

  return (
    <div className="space-y-4">
      <BACard
        title={sanitizeCustomerMarkdown(l?.band_plain || `Confidence: ${cs.band} (${cs.score}/100)`)}
        badge="Confidence"
      >
        <CustomerSafeText text={l?.headline || cs.headline} className="text-sm text-white/75" />
      </BACard>
      <div className="grid gap-4 md:grid-cols-2">
        <BACard title="What the System Knows">
          <CustomerSafeListItems items={l?.what_system_knows || []} />
        </BACard>
        <BACard title="What It Is Inferring">
          <CustomerSafeListItems items={l?.what_system_infers || []} />
        </BACard>
      </div>
      <BACard title="What Is Missing">
        <CustomerSafeListItems items={l?.what_is_missing || vm.missing_data.financial || []} />
        <div className="mt-3">
          <CustomerSafeText
            text={l?.customer_note || vm.missing_data.customer_note}
            className="text-sm text-white/60"
          />
        </div>
      </BACard>
      <BACard title="Confidence Counts">
        <CustomerSafeText
          text={
            l?.counts_plain ||
            `Known: ${cs.known_count} · Observed: ${cs.observed_count} · Inferred: ${cs.inferred_count} · Missing: ${cs.missing_count}`
          }
          className="text-sm text-white/75"
        />
      </BACard>
    </div>
  );
}