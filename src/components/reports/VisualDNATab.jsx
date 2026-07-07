import { useState } from 'react';
import VisualDNAModal from '../visualDNA/VisualDNAModal.jsx';
import { DIMENSION_COLORS } from '../../lib/reports/scoreLabels.js';

function ScoreArc({ dimension, score, color }) {
  const pct = Math.round((score ?? 0) * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/40"
        style={{
          background: `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
        }}
      >
        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-[#0a0a0a]">
          <span className="font-mono text-[0.65rem] font-bold text-white">
            {score !== null ? score.toFixed(2) : '—'}
          </span>
        </div>
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-wider text-white/55">{dimension}</span>
    </div>
  );
}

function ApprovedVisualPanel({ visualDNA }) {
  return (
    <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-6">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300/80">Approved Visual DNA</p>
      <p className="mt-3 text-sm leading-relaxed text-white/80">
        A visual representation of your Behavioral Operating System.
      </p>
      {visualDNA?.image_url ? (
        <img
          src={visualDNA.image_url}
          alt="Visual DNA operating system map"
          className="mt-6 w-full rounded-2xl border border-white/10"
        />
      ) : null}
    </article>
  );
}

function DraftVisualPanel({ personName, operatingScores = [], viewModel }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const availableScores = operatingScores.filter((score) => score.available);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300/80">Visual DNA draft</p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          This is a visual representation of your operating system. The final version will be upgraded.
        </p>
      </div>

      {viewModel ? (
        <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-6">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full rounded-2xl border border-orange-400/25 bg-orange-500/5 p-5 text-left transition hover:border-orange-400/40"
          >
            <p className="text-sm font-semibold text-white">Open deterministic Visual DNA preview</p>
            <p className="mt-2 text-xs text-white/55">Draft visual map from your operating scores and profile pattern.</p>
          </button>
          <VisualDNAModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            profile={{
              person_name: personName,
              profile_type: viewModel?.profileType,
              canonical_profile_json: viewModel?.canonical_profile_json,
            }}
          />
        </article>
      ) : null}

      {availableScores.length > 0 ? (
        <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-6">
          <div className="relative mx-auto max-w-lg">
            <div className="relative rounded-3xl border border-white/10 bg-black/50 p-8 backdrop-blur-sm">
              <p className="text-center text-[0.62rem] font-bold uppercase tracking-[0.24em] text-white/40">
                Operating System Map
              </p>
              <p className="mt-2 text-center text-lg font-bold text-white">{personName}</p>
              <div className="mt-6 grid grid-cols-4 gap-4">
                {operatingScores.map((score) => (
                  <ScoreArc
                    key={score.dimension}
                    dimension={score.dimension}
                    score={score.available ? score.score : null}
                    color={DIMENSION_COLORS[score.dimension] || '#fb923c'}
                  />
                ))}
              </div>
            </div>
          </div>
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-8 text-center">
          <p className="text-sm font-semibold text-white/70">Your Visual DNA will appear here.</p>
          <p className="mt-2 text-xs text-white/45">
            A finalized visual map will be added after review.
          </p>
        </div>
      )}
    </section>
  );
}

function PlaceholderPanel() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-12 text-center">
      <p className="text-lg font-semibold text-white/80">Your Visual DNA will appear here.</p>
      <p className="mt-3 text-sm text-white/50">
        Visual DNA has not been generated or approved for this profile yet.
      </p>
    </div>
  );
}

function isApprovedVisualDNA(visualDNA) {
  return Boolean(
    visualDNA?.image_url
    && (visualDNA.status === 'approved' || visualDNA.approved === true),
  );
}

export default function VisualDNATab({
  approvedVisualDNA = null,
  deterministicVisualDNA = null,
  personName = 'Your Behavioral Operating System',
  operatingScores = [],
}) {
  if (isApprovedVisualDNA(approvedVisualDNA)) {
    return <ApprovedVisualPanel visualDNA={approvedVisualDNA} />;
  }

  if (deterministicVisualDNA || operatingScores.some((score) => score.available)) {
    return (
      <DraftVisualPanel
        personName={personName}
        operatingScores={operatingScores}
        viewModel={deterministicVisualDNA}
      />
    );
  }

  return <PlaceholderPanel />;
}