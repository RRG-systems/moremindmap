import { SCORE_CLASSIFICATION_COLORS } from '../../lib/reports/scoreLabels.js';

function OperatingScoreCard({ score }) {
  const colorClass = SCORE_CLASSIFICATION_COLORS[score.classification]
    || SCORE_CLASSIFICATION_COLORS.unavailable;
  const label = score.displayName || score.dimension;

  return (
    <article className={`rounded-xl border p-3 ${colorClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{label}</h3>
        <span className="font-mono text-lg font-bold text-white">
          {score.available ? score.score.toFixed(2) : '—'}
        </span>
      </div>
      <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-white/55">
        {score.available ? score.classification : 'not available'}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/70">
        {score.available ? score.oneLine : 'Score not available for this profile.'}
      </p>
    </article>
  );
}

export default function OperatingScoresStrip({ scores = [] }) {
  return (
    <div className="border-b border-white/8 px-6 py-6">
      <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-white/45">
        Your operating scores
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scores.map((score) => (
          <OperatingScoreCard
            key={score.dimensionTechnical || score.dimension}
            score={score}
          />
        ))}
      </div>
    </div>
  );
}