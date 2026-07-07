export default function ScoreMeaningSection({ scoreMeaning }) {
  if (!scoreMeaning) return null;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-white/75">{scoreMeaning.subtitle}</p>

      {scoreMeaning.scores.map((score) => (
        <article key={score.dimension} className="rounded-xl border border-white/8 bg-black/25 p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h4 className="text-base font-bold text-white">{score.dimension}</h4>
            <span className="font-mono text-lg text-emerald-300">{score.score.toFixed(2)}</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-white/70">
              {score.classification}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            You scored {score.score.toFixed(2)} in {score.dimension}. That is a {score.classification} score. {score.whatItMeans}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-emerald-200/70">How it helps</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.howItHelps}</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-amber-200/70">How it can work against you</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.howItWorksAgainst}</p>
            </div>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-wider text-sky-200/70">Best use</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">{score.bestUse}</p>
            </div>
          </div>
        </article>
      ))}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/50">Pattern summary</p>
        <h4 className="mt-2 font-bold text-white">{scoreMeaning.patternSummary.headline}</h4>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{scoreMeaning.patternSummary.meaning}</p>
      </div>

      {scoreMeaning.unavailableDimensions?.length > 0 ? (
        <p className="text-xs text-white/45">
          {scoreMeaning.unavailableDimensions.join(', ')} — exact values not available; scores not fabricated.
        </p>
      ) : null}
    </div>
  );
}