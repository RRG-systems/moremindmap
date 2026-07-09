import { useState } from 'react';
import VisualDNAModal from '../visualDNA/VisualDNAModal.jsx';
import DeterministicBOSDNAVisualV2 from '../visualDNA/DeterministicBOSDNAVisualV2.jsx';

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

function BosDnaVisualPanel({ viewModel, personName, profileId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hasViewModel = Boolean(viewModel);

  return (
    <article className="rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-500/[0.07] via-black/20 to-violet-500/[0.06] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300/85">
            Behavioral Operating System Visual Map
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            Premium deterministic BOS DNA visual built from your operating scores and profile pattern.
            Rendered at display time — not stored as an image.
          </p>
        </div>
        {hasViewModel ? (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="rounded-full border border-orange-400/40 bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-100 transition hover:border-orange-300/60 hover:bg-orange-500/20"
          >
            Open full screen
          </button>
        ) : null}
      </div>

      {hasViewModel ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/50">
          <div className="w-full max-w-full overflow-hidden">
            <DeterministicBOSDNAVisualV2
              viewModel={viewModel}
              profile={viewModel}
              profileId={profileId || viewModel?.profileId}
              mode="preview"
              variant="preview"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/30 p-6 text-center">
          <p className="text-sm font-semibold text-white/70">BOS DNA Visual Map</p>
          <p className="mt-2 text-xs text-white/45">
            Deterministic visual data is not available for this profile yet.
          </p>
        </div>
      )}

      {hasViewModel ? (
        <VisualDNAModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          viewModel={viewModel}
          profile={viewModel}
          profileId={profileId || viewModel?.profileId}
        />
      ) : null}

      {!hasViewModel && personName ? (
        <p className="mt-3 text-[0.7rem] text-white/40">Profile: {personName}</p>
      ) : null}
    </article>
  );
}

function DraftVisualPanel({ personName, operatingScores = [], viewModel, profileId }) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/5 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300/80">Visual DNA draft</p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          This is a visual representation of your operating system. The final approved image version may be added after review.
        </p>
      </div>

      <BosDnaVisualPanel
        viewModel={viewModel}
        personName={personName}
        profileId={profileId}
      />

      {!viewModel && !operatingScores.some((score) => score.available) ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-8 text-center">
          <p className="text-sm font-semibold text-white/70">Your Visual DNA will appear here.</p>
          <p className="mt-2 text-xs text-white/45">
            A finalized visual map will be added after review.
          </p>
        </div>
      ) : null}
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
  profileId = null,
}) {
  const hasApproved = isApprovedVisualDNA(approvedVisualDNA);
  const hasDeterministic = Boolean(deterministicVisualDNA);
  const hasScores = operatingScores.some((score) => score.available);

  // Approved image remains prioritized and visible first.
  // BOS DNA Visual V2 is an additional premium deterministic artifact when data exists.
  if (hasApproved) {
    return (
      <section className="space-y-6">
        <ApprovedVisualPanel visualDNA={approvedVisualDNA} />
        {hasDeterministic || hasScores ? (
          <BosDnaVisualPanel
            viewModel={deterministicVisualDNA}
            personName={personName}
            profileId={profileId || deterministicVisualDNA?.profileId}
          />
        ) : null}
      </section>
    );
  }

  if (hasDeterministic || hasScores) {
    return (
      <DraftVisualPanel
        personName={personName}
        operatingScores={operatingScores}
        viewModel={deterministicVisualDNA}
        profileId={profileId || deterministicVisualDNA?.profileId}
      />
    );
  }

  return <PlaceholderPanel />;
}
