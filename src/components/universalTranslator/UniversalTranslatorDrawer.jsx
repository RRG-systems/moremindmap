import { useMemo, useState } from 'react';

const MODE_OPTIONS = [
  { value: 'plain_english', label: 'Plain English' },
  { value: 'explain_like_busy', label: "Explain it like I'm busy" },
  { value: 'coach_me_through_this', label: 'Coach me through this' }
];

function buildApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
}

function FieldBlock({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-cyan-200">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/78">{value}</p>
    </div>
  );
}

export default function UniversalTranslatorDrawer({
  isOpen,
  onClose,
  source,
}) {
  const [mode, setMode] = useState('plain_english');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [translation, setTranslation] = useState(null);

  const sourceTitle = source?.source_title || source?.title || 'Selected output';
  const preview = useMemo(() => String(source?.source_excerpt || '').slice(0, 420), [source]);

  if (!isOpen) return null;

  async function runTranslation() {
    if (!source?.source_excerpt) return;
    setStatus('loading');
    setError('');
    setTranslation(null);
    try {
      const response = await fetch(buildApiUrl('/api/universal-translator'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...source,
          translation_mode: mode
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error('translation_failed');
      }
      setTranslation(data);
      setStatus('done');
    } catch {
      setError('Translation is not available right now. The original output is unchanged.');
      setStatus('error');
    }
  }

  const translated = translation?.translation || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/58 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close translator" />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-white/12 bg-[#06070a] shadow-[-24px_0_80px_rgba(0,0,0,0.45)]">
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">Universal Translator</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Make MORE MindMap intelligence easier to understand.
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/72 transition hover:border-cyan-200/60 hover:text-cyan-100"
            >
              Close
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-white/45">Original section</p>
            <p className="mt-1 text-sm font-semibold text-white">{sourceTitle}</p>
            {preview && <p className="mt-2 line-clamp-4 text-sm leading-6 text-white/58">{preview}</p>}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${
                  mode === option.value
                    ? 'border-cyan-200/70 bg-cyan-300/12 text-cyan-50'
                    : 'border-white/10 bg-white/[0.035] text-white/62 hover:border-white/25 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={runTranslation}
            disabled={status === 'loading'}
            className="w-full rounded-2xl border border-cyan-200/40 bg-cyan-300/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-cyan-50 transition hover:border-cyan-100 hover:bg-cyan-300/16 disabled:cursor-wait disabled:opacity-55"
          >
            {status === 'loading' ? 'Translating...' : 'Translate'}
          </button>

          {error && (
            <div className="rounded-2xl border border-red-300/25 bg-red-500/[0.08] p-4 text-sm leading-6 text-red-100">
              {error}
            </div>
          )}

          {translation && (
            <div className="space-y-3">
              <FieldBlock label="What it says" value={translated.what_it_says} />
              <FieldBlock label="What it means" value={translated.what_it_means} />
              <FieldBlock label="Why it matters" value={translated.why_it_matters} />
              <FieldBlock label="What to do next" value={translated.what_to_do_next} />
              <FieldBlock label="How this shows up in real life" value={translated.how_this_shows_up_in_real_life} />
              <FieldBlock label="What not to overclaim" value={translated.what_not_to_overclaim} />
              <FieldBlock label="Truth boundary" value={translated.truth_boundary} />

              {translation.dictionary_terms_used?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-white/42">
                    Terms translated
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {translation.dictionary_terms_used.map((term) => (
                      <span key={term} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/64">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-5 text-xs leading-5 text-white/48">
          Original output remains the source of truth. Translation does not save, replace, or mutate MORE MindMap records.
        </div>
      </aside>
    </div>
  );
}
