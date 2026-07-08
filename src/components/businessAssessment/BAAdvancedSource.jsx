import { BACard } from './BAReadableSection.jsx';
import BAConfidenceEvidenceSection from './BAConfidenceEvidenceSection.jsx';

const ADVANCED_SOURCE_INTRO_LAB =
  'Technical source version for transparency. The main report tabs are the readable customer version — no Universal Translator required.';
const ADVANCED_SOURCE_INTRO_LIVE =
  'Technical source version for transparency. The main report tabs are the readable customer version.';

function resolveAdvancedSourceIntro(langIntro, showLabDebug) {
  if (showLabDebug) {
    return langIntro || ADVANCED_SOURCE_INTRO_LAB;
  }
  if (langIntro && !/universal translator|regular-person business talk|\/\d+\/100 technical/i.test(langIntro)) {
    return langIntro;
  }
  return ADVANCED_SOURCE_INTRO_LIVE;
}

export default function BAAdvancedSource({ vm, lang, showLabDebug = false }) {
  const prov = vm.model_provenance || {};
  const refs = vm.advanced_source_refs || {};
  const l = lang?.advanced_source;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300/70">
          Confidence &amp; Evidence
        </p>
        <BAConfidenceEvidenceSection vm={vm} lang={lang} />
      </div>
      <div className="space-y-4 border-t border-white/10 pt-6">
        <p className="text-[0.62rem] font-bold uppercase tracking-wider text-violet-300/70">
          Source / Technical Detail
        </p>
        <p className="text-sm leading-relaxed text-white/70">{resolveAdvancedSourceIntro(l?.intro, showLabDebug)}</p>
      <BACard title="Model Provenance" badge="Business">
        <div className="space-y-2 text-sm text-white/75">
          <p>
            Briefing: {prov.briefing_lab?.model || 'stored'} ({prov.briefing_lab?.scope || 'executive_diagnostic_briefing'})
          </p>
          <p>
            Five Futures: {prov.five_futures?.model || 'stored'} — {prov.five_futures?.scope || 'stored_five_futures_v1'}
          </p>
          <p>
            One Move: {prov.one_move?.model || 'stored'} — {prov.one_move?.scope || 'stored_one_move_v1'}
          </p>
        </div>
      </BACard>
      <BACard title="Artifact References">
        <div className="space-y-1 text-xs text-white/55">
          <p>Briefing sections: {refs.executive_diagnostic_briefing?.section_count ?? '—'}</p>
          <p>BID version: {refs.business_intelligence_draft?.version ?? '—'}</p>
          <p>Futures probability total: {refs.five_futures_v1?.probability_total ?? '—'}%</p>
        </div>
        {l?.preserved_artifacts ? (
          <ul className="mt-3 list-inside list-disc text-xs text-white/55">
            {l.preserved_artifacts.map((artifact) => (
              <li key={artifact}>{artifact}</li>
            ))}
          </ul>
        ) : null}
      </BACard>
      {vm.missing_data ? (
        <BACard title="Missing Data (Technical)" badge="Confidence">
          <ul className="list-inside list-disc text-sm text-white/70">
            {(vm.missing_data.financial || []).slice(0, 8).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-white/60">{vm.missing_data.customer_note}</p>
        </BACard>
      ) : null}
      </div>
    </div>
  );
}