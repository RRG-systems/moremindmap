import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const INDUSTRIES = [
  { label: 'Real Estate', disabled: false },
  { label: 'Mortgage (Beta Coming Soon)', disabled: true },
  { label: 'Automotive (Beta Coming Soon)', disabled: true },
  { label: 'Insurance (Beta Coming Soon)', disabled: true },
  { label: 'Financial Services (Beta Coming Soon)', disabled: true },
  { label: 'Professional Services (Beta Coming Soon)', disabled: true },
  { label: 'Other (Beta Coming Soon)', disabled: true }
];

const DIMENSION_LABELS = {
  vector: 'Command',
  velocity: 'Tempo',
  signal: 'Signal',
  fidelity: 'Precision',
  framework: 'Structure',
  flex: 'Adaptability',
  leverage: 'Leverage',
  horizon: 'Perspective'
};

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://moremindmap-backend.vercel.app';
  return `${baseUrl}${path}`;
}

function unwrapCanonical(payload) {
  const dossier = payload?.canonical_dossier || payload?.profile || payload;
  return dossier?.canonical_profile_json || dossier?.canonical_dossier?.canonical_profile_json || dossier;
}

function getRankedDimensions(canonical) {
  return (
    canonical?.rescoring_gpt?.ranked_dimensions ||
    canonical?.rescoring_v1?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    canonical?.dimension_scores ||
    []
  );
}

function normalizeDimensionName(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('vector') || raw.includes('command')) return 'vector';
  if (raw.includes('velocity') || raw.includes('tempo')) return 'velocity';
  if (raw.includes('signal')) return 'signal';
  if (raw.includes('fidelity') || raw.includes('precision')) return 'fidelity';
  if (raw.includes('framework') || raw.includes('structure')) return 'framework';
  if (raw.includes('flex') || raw.includes('adapt')) return 'flex';
  if (raw.includes('leverage')) return 'leverage';
  if (raw.includes('horizon') || raw.includes('perspective')) return 'horizon';
  return raw;
}

function getDimensionLabel(value) {
  const key = normalizeDimensionName(value);
  return DIMENSION_LABELS[key] || value || 'Profile';
}

function deriveProfileType(canonical) {
  const explicit =
    canonical?.profile_type ||
    canonical?.inferred_patterns?.profile_type ||
    canonical?.behavioral_profile?.profile_type ||
    canonical?.render_ready?.profile_dna;

  if (explicit && typeof explicit === 'string') return explicit;

  const ranked = getRankedDimensions(canonical);
  const primary = ranked?.[0]?.dimension || ranked?.[0]?.name || ranked?.[0]?.key;
  const secondary = ranked?.[1]?.dimension || ranked?.[1]?.name || ranked?.[1]?.key;

  if (primary && secondary) return `${getDimensionLabel(primary)} / ${getDimensionLabel(secondary)}`;
  if (primary) return getDimensionLabel(primary);
  return 'MORE MindMap Profile';
}

function extractProfileResult(payload, profileId) {
  const canonical = unwrapCanonical(payload);
  const metadata = canonical?.metadata || canonical?.profile_metadata || {};
  const answers = canonical?.answers || canonical?.assessment_answers || {};
  const name =
    canonical?.person_name ||
    canonical?.full_name ||
    canonical?.name ||
    metadata?.person_name ||
    metadata?.full_name ||
    metadata?.name ||
    answers?.name?.answer_text ||
    answers?.full_name?.answer_text ||
    'Profile Found';

  return {
    id: canonical?.profile_id || payload?.profile_id || profileId,
    name,
    profileType: deriveProfileType(canonical)
  };
}

export default function BusinessAssessment() {
  const [industry, setIndustry] = useState('Real Estate');
  const [profileId, setProfileId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [retrieveId, setRetrieveId] = useState('');
  const [profileResult, setProfileResult] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const normalizedProfileId = useMemo(() => profileId.trim(), [profileId]);

  async function validateProfile(event) {
    event.preventDefault();
    setProfileResult(null);
    setProfileError('');

    if (!normalizedProfileId) {
      setProfileError('Enter your MORE MindMap Profile ID to continue.');
      return;
    }

    setIsValidating(true);
    try {
      const url = buildApiUrl(
        `/api/moremindmap/retrieve-profile?id=${encodeURIComponent(normalizedProfileId)}&nocache=1`
      );
      const response = await fetch(url);
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.canonical_dossier) {
        setProfileError('Profile not found.\nPlease complete your MORE MindMap Profile first.');
        return;
      }

      setProfileResult(extractProfileResult(payload, normalizedProfileId));
    } catch {
      setProfileError('Profile not found.\nPlease complete your MORE MindMap Profile first.');
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.13),transparent_30%),linear-gradient(180deg,#050505_0%,#0b0b0d_52%,#000_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="mb-12 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold tracking-[0.28em] text-orange-300">
            MORE MINDMAP
          </Link>
          <Link
            to="/profile"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-white/80 transition hover:border-orange-400/60 hover:text-orange-200"
          >
            PROFILE
          </Link>
        </nav>

        <main className="grid flex-1 gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <section className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
                Business Assessment
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold uppercase tracking-[0.08em] text-white sm:text-5xl lg:text-6xl">
                SEE THE FUTURE YOUR BUSINESS IS CREATING.
              </h1>
              <div className="max-w-2xl space-y-4 text-lg leading-8 text-white/72">
                <p>Businesses rarely fail all at once.</p>
                <p>They drift.</p>
                <p>
                  The system identifies where your business is today, where it is headed next, and
                  the One Move most likely to change the outcome.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
                  Industry
                </h2>
                <select
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  className="w-full rounded-xl border border-orange-400/30 bg-black/70 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white outline-none transition focus:border-orange-300"
                >
                  {INDUSTRIES.map((option) => (
                    <option key={option.label} value={option.label} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
                  What You Receive
                </h2>
                <ul className="space-y-2 text-sm text-white/78">
                  {[
                    'Executive Business Summary',
                    'Business Operating System Diagnostic',
                    'Five Futures',
                    'The One Move',
                    'Retrieval By Profile ID'
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-orange-300">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.05] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-purple-200">
                Before You Start
              </h2>
              <div className="space-y-3 text-base leading-7 text-white/76">
                <p>Be honest.</p>
                <p>Be specific.</p>
                <p>The quality of the output depends on the quality of the reality provided.</p>
              </div>
            </section>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-orange-400/35 bg-gradient-to-br from-orange-500/12 via-white/[0.035] to-purple-500/10 p-6 shadow-[0_0_55px_rgba(249,115,22,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-300">
                Business Assessment
              </p>
              <div className="mt-4 text-6xl font-semibold tracking-tight text-white">$49</div>
              <p className="mt-4 text-base leading-7 text-white/70">
                See the future your business is creating.
              </p>
              <div className="mt-5 space-y-1 text-lg font-semibold text-white/86">
                <p>Business Assessment</p>
                <p>+</p>
                <p>Five Futures</p>
                <p>+</p>
                <p>One Move</p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-white">
                Start Here
              </h2>
              <form className="mt-5 space-y-4" onSubmit={validateProfile}>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/62">
                  Enter Your Profile ID
                </label>
                <input
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  placeholder="MM-20260531-XXXXXXX"
                  className="w-full rounded-xl border border-white/12 bg-black/65 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none transition placeholder:text-white/34 focus:border-orange-300"
                />
                <button
                  type="submit"
                  disabled={isValidating}
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-black transition hover:bg-orange-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {isValidating ? 'Validating...' : 'Validate Profile'}
                </button>
              </form>

              {profileResult && (
                <div className="mt-5 rounded-2xl border border-emerald-400/35 bg-emerald-400/[0.08] p-4">
                  <p className="text-sm font-semibold text-emerald-200">✓ Profile Found</p>
                  <p className="mt-2 text-lg font-semibold text-white">{profileResult.name}</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.16em] text-white/62">
                    {profileResult.profileType}
                  </p>
                </div>
              )}

              {profileError && (
                <div className="mt-5 whitespace-pre-line rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
                  {profileError}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                Have A Promo Code?
              </h2>
              <input
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value)}
                placeholder="Enter Promo Code"
                className="mt-4 w-full rounded-xl border border-white/12 bg-black/60 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/34 focus:border-purple-300"
              />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                Already Completed A Business Assessment?
              </h2>
              <input
                value={retrieveId}
                onChange={(event) => setRetrieveId(event.target.value)}
                placeholder="Enter Profile ID"
                className="mt-4 w-full rounded-xl border border-white/12 bg-black/60 px-4 py-3 text-sm uppercase tracking-[0.08em] text-white outline-none placeholder:text-white/34 focus:border-blue-300"
              />
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-xl border border-white/14 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white/45"
              >
                Retrieve
              </button>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
