/**
 * MMB13 lab-only — Visual DNA draft panel (placeholder, no generation).
 */

import { ALL_OPERATING_SCORES } from './finalBosCustomerData.js';

const DIMENSION_COLORS = {
  Vector: '#fb923c',
  Velocity: '#f97316',
  Signal: '#38bdf8',
  Fidelity: '#60a5fa',
  Leverage: '#a78bfa',
  Flex: '#c084fc',
  Framework: '#fbbf24',
  Horizon: '#f87171',
};

function ScoreArc({ dimension, score, color }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/40"
        style={{
          background: `conic-gradient(${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
        }}
      >
        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-[#0a0a0a]">
          <span className="font-mono text-[0.65rem] font-bold text-white">{score.toFixed(2)}</span>
        </div>
      </div>
      <span className="text-[0.6rem] font-bold uppercase tracking-wider text-white/55">{dimension}</span>
    </div>
  );
}

export default function VisualDNADraftPanel() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300/80">Visual DNA draft</p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          This is a visual representation of your operating system. The final version will be upgraded.
        </p>
        <p className="mt-2 text-xs text-white/50">
          No image generation in this lab preview. The panel below uses your known operating scores as a deterministic visual sketch.
        </p>
      </div>

      <article className="rounded-2xl border border-white/12 bg-white/[0.03] p-6">
        <div className="relative mx-auto max-w-lg">
          <div
            className="absolute inset-0 rounded-3xl opacity-40"
            style={{
              background:
                'radial-gradient(circle at 30% 40%, rgba(251,146,60,0.25), transparent 50%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.2), transparent 45%)',
            }}
          />
          <div className="relative rounded-3xl border border-white/10 bg-black/50 p-8 backdrop-blur-sm">
            <p className="text-center text-[0.62rem] font-bold uppercase tracking-[0.24em] text-white/40">
              Operating System Map
            </p>
            <p className="mt-2 text-center text-lg font-bold text-white">Avery North</p>
            <div className="mt-6 grid grid-cols-4 gap-4">
              {ALL_OPERATING_SCORES.map((s) => (
                <ScoreArc
                  key={s.dimension}
                  dimension={s.dimension}
                  score={s.score}
                  color={DIMENSION_COLORS[s.dimension] || '#fb923c'}
                />
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-orange-400/20 bg-orange-500/5 px-4 py-3 text-center text-xs text-white/65">
              High Vector + Velocity drive outward momentum · Low Framework + Horizon need external scaffolding
            </div>
          </div>
        </div>
      </article>

      <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-8 text-center">
        <p className="text-sm font-semibold text-white/70">Visual DNA draft will appear here</p>
        <p className="mt-2 text-xs text-white/45">
          The production Visual DNA image will replace this placeholder after human review and approval.
        </p>
      </div>
    </section>
  );
}
