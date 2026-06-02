import React, { useMemo, useState } from 'react';
import DeterministicVisualDNA from './components/visualDNA/DeterministicVisualDNA.jsx';
import {
  MARCUS_VISUAL_DNA_SAMPLE,
  WALLY_VISUAL_DNA_SAMPLE,
} from './lib/visualDNA/buildVisualDNAViewModel.js';

const PROFILES = {
  wally: WALLY_VISUAL_DNA_SAMPLE,
  marcus: MARCUS_VISUAL_DNA_SAMPLE,
};

export default function VisualDNAPreview() {
  const [active, setActive] = useState('wally');
  const profile = useMemo(() => PROFILES[active] || WALLY_VISUAL_DNA_SAMPLE, [active]);

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto mb-6 flex max-w-[1672px] flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">
            Deterministic Visual DNA Preview
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Visual Operating System Poster
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60 md:text-base">
            Step 1 preview only. This route does not replace the live Visual DNA image pipeline.
          </p>
        </div>

        <div className="flex gap-3">
          {Object.keys(PROFILES).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={[
                'rounded-lg border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
                active === key
                  ? 'border-orange-400 bg-orange-400 text-black'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10',
              ].join(' ')}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <DeterministicVisualDNA profile={profile} variant={active} />
    </main>
  );
}
